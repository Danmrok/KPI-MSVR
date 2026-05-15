import SwiftUI

struct ContentView: View {
    @State private var isTracking = false
    @State private var showInfo = false

    var body: some View {
        ZStack(alignment: .bottom) {
            ARViewContainer(isTracking: $isTracking)
                .ignoresSafeArea()

            VStack(spacing: 0) {
                // Status bar
                HStack {
                    Circle()
                        .fill(isTracking ? Color.green : Color.orange)
                        .frame(width: 10, height: 10)
                        .animation(.easeInOut(duration: 0.4), value: isTracking)

                    Text(isTracking ? "Marker detected" : "Searching for marker…")
                        .font(.system(size: 13, weight: .medium, design: .monospaced))
                        .foregroundColor(.white)

                    Spacer()

                    Button {
                        showInfo.toggle()
                    } label: {
                        Image(systemName: "info.circle")
                            .foregroundColor(.white)
                            .font(.system(size: 18))
                    }
                }
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(.ultraThinMaterial)
            }
            .frame(maxHeight: .infinity, alignment: .top)

            if showInfo {
                InfoOverlay(dismiss: { showInfo = false })
                    .transition(.move(edge: .bottom).combined(with: .opacity))
                    .animation(.spring(response: 0.4), value: showInfo)
            }
        }
        .statusBarHidden(true)
    }
}

struct InfoOverlay: View {
    let dismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("AR Shoe Surface")
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .foregroundColor(.cyan)
                Spacer()
                Button(action: dismiss) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundColor(.gray)
                        .font(.system(size: 22))
                }
            }

            Divider().background(Color.cyan.opacity(0.4))

            infoRow(icon: "viewfinder", text: "Point camera at the printed AR marker")
            infoRow(icon: "rotate.3d", text: "Move around to view 3D shoe from all angles")
            infoRow(icon: "eyeglasses", text: "Wear red-cyan glasses for anaglyphic mode")
            infoRow(icon: "doc.text", text: "Print marker from included marker.pdf at 100%")

            Divider().background(Color.cyan.opacity(0.2))

            Text("Surface: parametric shoe model (80×36 segments)")
                .font(.system(size: 11, design: .monospaced))
                .foregroundColor(.gray)
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(.ultraThickMaterial)
                .overlay(
                    RoundedRectangle(cornerRadius: 16)
                        .stroke(Color.cyan.opacity(0.3), lineWidth: 1)
                )
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 24)
    }

    func infoRow(icon: String, text: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundColor(.cyan)
                .frame(width: 20)
            Text(text)
                .font(.system(size: 13))
                .foregroundColor(.white.opacity(0.85))
        }
    }
}
