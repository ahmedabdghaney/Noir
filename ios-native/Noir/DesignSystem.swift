import SwiftUI

enum NoirDesign {
    static let accent = Color.accentColor
    static let background = Color(uiColor: .black)
    static let secondaryBackground = Color(uiColor: .secondarySystemBackground)
    static let tertiaryBackground = Color(uiColor: .tertiarySystemBackground)

    enum Space {
        static let xSmall: CGFloat = 4
        static let small: CGFloat = 8
        static let medium: CGFloat = 12
        static let standard: CGFloat = 16
        static let page: CGFloat = 20
        static let section: CGFloat = 36
        static let large: CGFloat = 40
    }

    enum Radius {
        static let small: CGFloat = 10
        static let card: CGFloat = 14
        static let largeCard: CGFloat = 18
    }

    static let horizontalPadding = Space.page
    static let cardRadius = Radius.card
    static let actionHeight: CGFloat = 52
    static let posterWidth: CGFloat = 112
    static let posterHeight: CGFloat = 168
    static let continueWidth: CGFloat = 270
    static let continueHeight: CGFloat = 180
}

private struct NoirGlassModifier: ViewModifier {
    let interactive: Bool

    @ViewBuilder
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular.interactive(interactive), in: .capsule)
        } else {
            content
                .background(.ultraThinMaterial, in: Capsule())
                .overlay(Capsule().strokeBorder(.white.opacity(0.12), lineWidth: 0.5))
        }
    }
}

extension View {
    func noirGlass(interactive: Bool = false) -> some View {
        modifier(NoirGlassModifier(interactive: interactive))
    }
}

struct ArtworkView: View {
    let url: URL?
    var contentMode: ContentMode = .fill

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeInOut(duration: 0.20))) { phase in
            switch phase {
            case .success(let image):
                image
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .transition(.opacity)
            case .failure:
                placeholder
            case .empty:
                ZStack {
                    placeholder
                    ProgressView().tint(.secondary)
                }
            @unknown default:
                placeholder
            }
        }
        .accessibilityHidden(true)
    }

    private var placeholder: some View {
        ZStack {
            NoirDesign.secondaryBackground
            Image(systemName: "film.stack")
                .font(.title2)
                .foregroundStyle(.tertiary)
        }
    }
}

struct AppleCardBlur: View {
    var body: some View {
        ZStack {
            Rectangle()
                .fill(.ultraThinMaterial)
                .mask {
                    LinearGradient(
                        stops: [
                            .init(color: .clear, location: 0.30),
                            .init(color: .black.opacity(0.58), location: 0.54),
                            .init(color: .black, location: 0.73)
                        ],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }

            LinearGradient(
                stops: [
                    .init(color: .clear, location: 0.31),
                    .init(color: .black.opacity(0.24), location: 0.56),
                    .init(color: .black.opacity(0.70), location: 1)
                ],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .allowsHitTesting(false)
    }
}

private struct AppleGlassCardRim: ViewModifier {
    let radius: CGFloat

    func body(content: Content) -> some View {
        content.overlay {
            RoundedRectangle(cornerRadius: radius, style: .continuous)
                .strokeBorder(
                    LinearGradient(
                        stops: [
                            .init(color: .white.opacity(0.38), location: 0),
                            .init(color: .white.opacity(0.11), location: 0.34),
                            .init(color: .white.opacity(0.04), location: 0.62),
                            .init(color: .white.opacity(0.20), location: 1)
                        ],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ),
                    lineWidth: 0.7
                )
                .blendMode(.plusLighter)
                .allowsHitTesting(false)
        }
    }
}

extension View {
    func appleGlassCardRim(radius: CGFloat) -> some View {
        modifier(AppleGlassCardRim(radius: radius))
    }
}

struct PrimaryActionLabel: View {
    let title: String
    let systemImage: String

    var body: some View {
        Label(title, systemImage: systemImage)
            .font(.headline.weight(.semibold))
            .foregroundStyle(.black)
            .padding(.horizontal, 24)
            .frame(minWidth: 150, minHeight: NoirDesign.actionHeight)
            .background(.white, in: Capsule())
            .contentShape(Capsule())
    }
}

struct LibraryActionButton: View {
    let isSaved: Bool
    let action: () -> Void
    var size: CGFloat = NoirDesign.actionHeight

    var body: some View {
        Button {
            withAnimation(.easeOut(duration: 0.14)) {
                action()
            }
        } label: {
            ZStack {
                Circle()
                    .fill(.white)
                    .opacity(isSaved ? 1 : 0)

                Image(systemName: isSaved ? "checkmark" : "plus")
                    .font(.title3.weight(.semibold))
                    .foregroundStyle(isSaved ? .black : .white)
                    .contentTransition(.symbolEffect(.replace))
            }
            .frame(width: size, height: size)
            .noirGlass(interactive: true)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isSaved ? "Remove from My List" : "Add to My List")
    }
}

struct SectionHeader: View {
    let title: String
    var showsChevron = true

    var body: some View {
        HStack(spacing: 5) {
            Text(title)
                .font(.title2.weight(.bold))
                .foregroundStyle(.primary)
            if showsChevron {
                Image(systemName: "chevron.right")
                    .font(.headline.weight(.bold))
                    .foregroundStyle(.tertiary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, NoirDesign.horizontalPadding)
        .accessibilityAddTraits(.isHeader)
    }
}
