import SceneKit

/// Pure-Swift port of the parametric shoe surface defined in Model.js.
/// Uses the same mathematical formulation: uSegments × vSegments mesh.
enum ShoeGeometry {

    /// Returns (vertices, triangleIndices) ready for SceneKit.
    static func generate(uSegments: Int = 80, vSegments: Int = 36) -> ([SCNVector3], [Int32]) {
        let row = vSegments + 1
        let vertexCount = (uSegments + 1) * row

        var vertices = [SCNVector3]()
        vertices.reserveCapacity(vertexCount)

        for i in 0...uSegments {
            let u = Float(i) / Float(uSegments)
            for j in 0...vSegments {
                let v = (Float(j) / Float(vSegments)) * 2.0 - 1.0
                let p = shoePoint(u: u, v: v)
                vertices.append(p)
            }
        }

        // Build triangle indices (two triangles per quad)
        var indices = [Int32]()
        indices.reserveCapacity(uSegments * vSegments * 6)

        for i in 0..<uSegments {
            for j in 0..<vSegments {
                let i0 = Int32(i * row + j)
                let i1 = i0 + 1
                let i2 = i0 + Int32(row)
                let i3 = i2 + 1

                // Triangle 1
                indices.append(i0); indices.append(i2); indices.append(i1)
                // Triangle 2
                indices.append(i1); indices.append(i2); indices.append(i3)
            }
        }

        return (vertices, indices)
    }

    // MARK: - Parametric surface formula (matches Model.js shoePoint)

    private static func shoePoint(u: Float, v: Float) -> SCNVector3 {
        let x = (u - 0.5) * 4.2

        let toeBulge = 0.25 * exp(-pow((u - 0.88) / 0.18, 2))
        let widthProfile = 0.42 + 0.20 * sin(.pi * u) + toeBulge
        let y = widthProfile * v * (0.95 - 0.18 * u)

        let arch = 0.24 * sin(.pi * u)
        let sole = -0.18 * (x * x) / 4.41
        let crossShape = 0.07 * cos(.pi * v)
        let z = arch + sole + crossShape

        return SCNVector3(x, y, z)
    }
}
