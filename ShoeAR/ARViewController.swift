import SwiftUI
import ARKit
import SceneKit

// MARK: - SwiftUI wrapper

struct ARViewContainer: UIViewControllerRepresentable {
    @Binding var isTracking: Bool

    func makeUIViewController(context: Context) -> ARViewController {
        let vc = ARViewController()
        vc.onTrackingChanged = { tracking in
            DispatchQueue.main.async { isTracking = tracking }
        }
        return vc
    }

    func updateUIViewController(_ uiViewController: ARViewController, context: Context) {}
}

// MARK: - AR View Controller

class ARViewController: UIViewController, ARSCNViewDelegate {

    var sceneView: ARSCNView!
    var onTrackingChanged: ((Bool) -> Void)?
    private var isCurrentlyTracking = false

    // MARK: - Lifecycle

    override func viewDidLoad() {
        super.viewDidLoad()

        sceneView = ARSCNView(frame: view.bounds)
        sceneView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        view.addSubview(sceneView)

        sceneView.delegate = self
        sceneView.showsStatistics = false
        sceneView.automaticallyUpdatesLighting = true
        sceneView.rendersContinuously = true

        setupLights()
    }

    override func viewWillAppear(_ animated: Bool) {
        super.viewWillAppear(animated)

        guard ARImageTrackingConfiguration.isSupported else {
            showUnsupportedAlert(); return
        }

        let configuration = ARImageTrackingConfiguration()
        if let referenceImages = ARReferenceImage.referenceImages(
            inGroupNamed: "AR Images", bundle: .main) {
            configuration.trackingImages = referenceImages
            configuration.maximumNumberOfTrackedImages = 1
        }
        sceneView.session.run(configuration,
                              options: [.resetTracking, .removeExistingAnchors])
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        sceneView.session.pause()
    }

    // MARK: - ARSCNViewDelegate

    func renderer(_ renderer: SCNSceneRenderer, didAdd node: SCNNode, for anchor: ARAnchor) {
        guard let imageAnchor = anchor as? ARImageAnchor else { return }

        let mW = Float(imageAnchor.referenceImage.physicalSize.width)
        let mH = Float(imageAnchor.referenceImage.physicalSize.height)

        node.addChildNode(buildStereoNode(markerWidth: mW, markerHeight: mH))

        DispatchQueue.main.async { [weak self] in
            self?.isCurrentlyTracking = true
            self?.onTrackingChanged?(true)
        }
    }

    func renderer(_ renderer: SCNSceneRenderer, didUpdate node: SCNNode, for anchor: ARAnchor) {
        guard let imageAnchor = anchor as? ARImageAnchor else { return }
        let tracked = imageAnchor.isTracked
        node.isHidden = !tracked
        if tracked != isCurrentlyTracking {
            isCurrentlyTracking = tracked
            DispatchQueue.main.async { [weak self] in self?.onTrackingChanged?(tracked) }
        }
    }

    func renderer(_ renderer: SCNSceneRenderer, didRemove node: SCNNode, for anchor: ARAnchor) {
        guard anchor is ARImageAnchor else { return }
        DispatchQueue.main.async { [weak self] in
            self?.isCurrentlyTracking = false
            self?.onTrackingChanged?(false)
        }
    }

    // MARK: - Node builder

    private func buildStereoNode(markerWidth mW: Float, markerHeight mH: Float) -> SCNNode {
        let (vertices, triIdx) = ShoeGeometry.generate(uSegments: 80, vSegments: 36)
        let wireIdx = makeWireIndices(triIdx)

        // ── Bounding box in model space ───────────────────────────────────────
        // After rotation eulerAngles(-π/2, 0, 0):
        //   model X → world X (markerWidth  axis)
        //   model Y → world Z (markerHeight axis)
        //   model Z → world Y (height above marker)
        var minX = Float.infinity, maxX = -Float.infinity
        var minY = Float.infinity, maxY = -Float.infinity
        var minZ = Float.infinity, maxZ = -Float.infinity
        for v in vertices {
            minX = min(minX, v.x); maxX = max(maxX, v.x)
            minY = min(minY, v.y); maxY = max(maxY, v.y)
            minZ = min(minZ, v.z); maxZ = max(maxZ, v.z)
        }
        let modelSizeX = maxX - minX   // maps to markerWidth
        let modelSizeY = maxY - minY   // maps to markerHeight
        let modelSizeZ = maxZ - minZ   // maps to height above marker

        let centerX = (minX + maxX) * 0.5
        let centerY = (minY + maxY) * 0.5
        let centerZ = (minZ + maxZ) * 0.5

        // ── Scale: fit inside marker with 5% padding ──────────────────────────
        let padding: Float = 0.95
        let scaleForWidth  = (mW * padding) / modelSizeX
        let scaleForHeight = (mH * padding) / modelSizeY
        let scale = min(scaleForWidth, scaleForHeight)

        // ── Eye shift ─────────────────────────────────────────────────────────
        // Keep TOTAL spread (leftEye + rightEye) within the scaled model width.
        // Max safe shift = half the remaining space after model is placed.
        // We use a small fixed fraction of marker width — just enough for 3D effect.
        // 3% of markerWidth gives a subtle but visible anaglyph without overflow.
        let maxSafeShift = (mW - modelSizeX * scale) * 0.5  // remaining space on each side
        let desiredShift = mW * 0.03                         // 3% of marker width
        let eyeShift     = min(desiredShift, maxSafeShift)   // never exceed safe bounds

        let root = SCNNode()

        // Left eye — red
        root.addChildNode(makeEyeNode(
            vertices: vertices, triIdx: triIdx, wireIdx: wireIdx,
            filled: UIColor(red: 1,   green: 0,   blue: 0,   alpha: 1),
            wire:   UIColor(red: 0.3, green: 0,   blue: 0,   alpha: 1),
            scale: scale, cx: centerX, cy: centerY, cz: centerZ,
            xShift: +eyeShift
        ))

        // Right eye — cyan
        root.addChildNode(makeEyeNode(
            vertices: vertices, triIdx: triIdx, wireIdx: wireIdx,
            filled: UIColor(red: 0,   green: 1,   blue: 1,   alpha: 1),
            wire:   UIColor(red: 0,   green: 0.3, blue: 0.3, alpha: 1),
            scale: scale, cx: centerX, cy: centerY, cz: centerZ,
            xShift: -eyeShift
        ))

        // Rotate shoe flat onto marker plane
        root.eulerAngles = SCNVector3(-Float.pi / 2, 0, 0)

        // Lift so bottom of shoe sits on marker surface
        let liftY = (modelSizeZ * scale) * 0.5 + 0.001
        root.position = SCNVector3(0, liftY, 0)

        return root
    }

    // MARK: - Eye node

    private func makeEyeNode(
        vertices: [SCNVector3],
        triIdx: [Int32],
        wireIdx: [Int32],
        filled: UIColor,
        wire: UIColor,
        scale: Float,
        cx: Float, cy: Float, cz: Float,
        xShift: Float
    ) -> SCNNode {

        // Filled surface
        let fg = buildGeom(vertices: vertices, indices: triIdx, type: .triangles)
        let fm = SCNMaterial()
        fm.diffuse.contents  = filled
        fm.specular.contents = filled
        fm.shininess = 60
        fm.isDoubleSided = true
        fm.writesToDepthBuffer  = true
        fm.readsFromDepthBuffer = true
        fg.materials = [fm]

        // Wireframe on top
        let wg = buildGeom(vertices: vertices, indices: wireIdx, type: .line)
        let wm = SCNMaterial()
        wm.diffuse.contents     = wire
        wm.isDoubleSided        = true
        wm.readsFromDepthBuffer = true
        wg.materials = [wm]

        let eye = SCNNode()
        eye.addChildNode(SCNNode(geometry: fg))
        eye.addChildNode(SCNNode(geometry: wg))

        eye.scale    = SCNVector3(scale, scale, scale)
        eye.position = SCNVector3(
            xShift - cx * scale,
            -cy * scale,
            -cz * scale
        )
        return eye
    }

    // MARK: - Geometry helpers

    private func buildGeom(
        vertices: [SCNVector3],
        indices: [Int32],
        type: SCNGeometryPrimitiveType
    ) -> SCNGeometry {
        let vData = Data(bytes: vertices,
                         count: vertices.count * MemoryLayout<SCNVector3>.stride)
        let src = SCNGeometrySource(
            data: vData, semantic: .vertex,
            vectorCount: vertices.count,
            usesFloatComponents: true,
            componentsPerVector: 3,
            bytesPerComponent: MemoryLayout<Float>.size,
            dataOffset: 0,
            dataStride: MemoryLayout<SCNVector3>.stride
        )
        let primCount = type == .triangles ? indices.count / 3 : indices.count / 2
        let iData = Data(bytes: indices,
                         count: indices.count * MemoryLayout<Int32>.stride)
        let elem = SCNGeometryElement(
            data: iData, primitiveType: type,
            primitiveCount: primCount,
            bytesPerIndex: MemoryLayout<Int32>.size
        )
        return SCNGeometry(sources: [src], elements: [elem])
    }

    private func makeWireIndices(_ tri: [Int32]) -> [Int32] {
        var w = [Int32]()
        w.reserveCapacity(tri.count * 2)
        var i = 0
        while i + 2 < tri.count {
            let a = tri[i], b = tri[i+1], c = tri[i+2]
            w.append(contentsOf: [a, b, b, c, c, a])
            i += 3
        }
        return w
    }

    // MARK: - Lights

    private func setupLights() {
        let al = SCNLight(); al.type = .ambient
        al.intensity = 500; al.color = UIColor(white: 1, alpha: 1)
        let an = SCNNode(); an.light = al
        sceneView.scene.rootNode.addChildNode(an)

        let dl = SCNLight(); dl.type = .directional
        dl.intensity = 800; dl.castsShadow = false
        let dn = SCNNode(); dn.light = dl
        dn.eulerAngles = SCNVector3(-Float.pi/4, Float.pi/4, 0)
        sceneView.scene.rootNode.addChildNode(dn)
    }

    // MARK: - Alert

    private func showUnsupportedAlert() {
        DispatchQueue.main.async {
            let alert = UIAlertController(
                title: "AR Not Supported",
                message: "Image tracking requires an A9 chip or later.",
                preferredStyle: .alert
            )
            alert.addAction(UIAlertAction(title: "OK", style: .default))
            self.present(alert, animated: true)
        }
    }
}
