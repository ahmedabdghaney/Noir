import SwiftUI

struct OnboardingView: View {
    let onComplete: () -> Void

    @EnvironmentObject private var authentication: AuthenticationStore
    @State private var page = 0

    private let pages = OnboardingPage.all

    var body: some View {
        ZStack {
            NoirDesign.background.ignoresSafeArea()

            TabView(selection: $page) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, item in
                    onboardingPage(item, isSignIn: index == pages.count - 1)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))

            VStack(spacing: 18) {
                Spacer()

                HStack(spacing: 7) {
                    ForEach(pages.indices, id: \.self) { index in
                        Capsule()
                            .fill(.white.opacity(index == page ? 0.95 : 0.25))
                            .frame(width: index == page ? 24 : 7, height: 7)
                    }
                }
                .animation(.smooth(duration: 0.25), value: page)

                if page == pages.count - 1 {
                    VStack(spacing: 12) {
                        Button {
                            Task {
                                if await authentication.signInWithGoogle() {
                                    onComplete()
                                }
                            }
                        } label: {
                            Group {
                                if authentication.isSigningIn {
                                    ProgressView()
                                        .tint(.black)
                                } else {
                                    Label("Continue with Google", systemImage: "person.crop.circle.badge.checkmark")
                                }
                            }
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(.white, in: Capsule())
                        }
                        .buttonStyle(.plain)
                        .disabled(authentication.isSigningIn)

                        Button("Continue as Guest") {
                            UserDefaults.standard.set("guest", forKey: "noir.ios.account.mode")
                            onComplete()
                        }
                        .font(.headline.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .noirGlass(interactive: true)
                    }
                } else {
                    Button {
                        withAnimation(.smooth(duration: 0.28)) { page += 1 }
                    } label: {
                        Label("Continue", systemImage: "arrow.right")
                            .font(.headline.weight(.semibold))
                            .foregroundStyle(.black)
                            .frame(maxWidth: .infinity, minHeight: 52)
                            .background(.white, in: Capsule())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 24)
            .padding(.bottom, 24)
        }
        .tint(NoirDesign.accent)
        .alert("Couldn’t Sign In", isPresented: Binding(
            get: { authentication.errorMessage != nil },
            set: { if !$0 { authentication.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {
                authentication.errorMessage = nil
            }
        } message: {
            Text(authentication.errorMessage ?? "Please try again.")
        }
    }

    private func onboardingPage(_ item: OnboardingPage, isSignIn: Bool) -> some View {
        VStack(spacing: 24) {
            Spacer(minLength: 54)

            ZStack {
                Circle()
                    .fill(item.color.opacity(0.22))
                    .frame(width: 210, height: 210)
                    .blur(radius: 18)

                Image(systemName: item.symbol)
                    .font(.system(size: 76, weight: .medium))
                    .symbolRenderingMode(.hierarchical)
                    .foregroundStyle(isSignIn ? .white : item.color)
            }

            VStack(spacing: 12) {
                Text(item.title)
                    .font(.largeTitle.weight(.bold))
                    .multilineTextAlignment(.center)

                Text(item.subtitle)
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .lineSpacing(3)
                    .frame(maxWidth: 330)
            }

            Spacer(minLength: 180)
        }
        .padding(.horizontal, 24)
    }
}

private struct OnboardingPage {
    let title: String
    let subtitle: String
    let symbol: String
    let color: Color

    static let all = [
        OnboardingPage(
            title: "Everything You Want to Watch",
            subtitle: "Movies, shows, and your saved titles in one focused experience.",
            symbol: "play.tv.fill",
            color: NoirDesign.accent
        ),
        OnboardingPage(
            title: "Continue Anywhere",
            subtitle: "Pick up from the exact moment you stopped and keep your list close.",
            symbol: "play.circle.fill",
            color: .white
        ),
        OnboardingPage(
            title: "Made for iPhone",
            subtitle: "Native playback, Picture in Picture, AirPlay, and system accessibility.",
            symbol: "iphone.gen3",
            color: NoirDesign.accent
        ),
        OnboardingPage(
            title: "Welcome to Noir",
            subtitle: "Sign in to sync your experience, or start immediately as a guest.",
            symbol: "person.crop.circle.fill",
            color: .white
        )
    ]
}

struct ProfileButton: View {
    @EnvironmentObject private var authentication: AuthenticationStore
    @State private var showsProfile = false

    var body: some View {
        Button {
            showsProfile = true
        } label: {
            ProfileAvatar(url: authentication.photoURL, size: 40)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Profile")
        .sheet(isPresented: $showsProfile) {
            ProfileSheet()
                .presentationDetents([.medium, .large])
                .presentationDragIndicator(.visible)
                .presentationBackground(.ultraThinMaterial)
        }
    }
}

private struct ProfileSheet: View {
    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var store: AppStore
    @EnvironmentObject private var authentication: AuthenticationStore
    @AppStorage("noir.ios.onboarding.complete") private var didCompleteOnboarding = true
    @AppStorage("noir.ios.autoplay") private var autoplay = true

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack(spacing: 14) {
                        ProfileAvatar(url: authentication.photoURL, size: 58)

                        VStack(alignment: .leading, spacing: 3) {
                            Text(authentication.user == nil ? "Guest" : authentication.displayName)
                                .font(.headline)
                            Text(authentication.email ?? "Your activity stays on this iPhone")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(.vertical, 6)
                }

                Section("Account") {
                    if authentication.user == nil {
                        Button {
                            Task {
                                _ = await authentication.signInWithGoogle()
                            }
                        } label: {
                            if authentication.isSigningIn {
                                HStack {
                                    ProgressView()
                                    Text("Signing In…")
                                }
                            } else {
                                Label("Continue with Google", systemImage: "person.crop.circle.badge.checkmark")
                            }
                        }
                        .disabled(authentication.isSigningIn)
                    } else {
                        Button(role: .destructive) {
                            do {
                                try authentication.signOut()
                                dismiss()
                                DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                                    didCompleteOnboarding = false
                                }
                            } catch {
                                authentication.errorMessage = error.localizedDescription
                            }
                        } label: {
                            Label("Sign Out", systemImage: "rectangle.portrait.and.arrow.right")
                        }
                    }
                }

                Section("Playback") {
                    Toggle("Autoplay", isOn: $autoplay)
                        .tint(NoirDesign.accent)

                    Button(role: .destructive) {
                        store.clearContinueWatching()
                    } label: {
                        Label("Clear Continue Watching", systemImage: "trash")
                    }
                }

                Section("Setup") {
                    Button {
                        dismiss()
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
                            didCompleteOnboarding = false
                        }
                    } label: {
                        Label("Run Setup Again", systemImage: "sparkles")
                    }
                }

                Section {
                    HStack {
                        Text("Noir for iPhone")
                        Spacer()
                        Text("1.0")
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.black.opacity(0.72))
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                        .foregroundStyle(NoirDesign.accent)
                }
            }
        }
        .preferredColorScheme(.dark)
        .tint(NoirDesign.accent)
        .alert("Couldn’t Sign In", isPresented: Binding(
            get: { authentication.errorMessage != nil },
            set: { if !$0 { authentication.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {
                authentication.errorMessage = nil
            }
        } message: {
            Text(authentication.errorMessage ?? "Please try again.")
        }
    }
}

private struct ProfileAvatar: View {
    let url: URL?
    let size: CGFloat

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    if let image = phase.image {
                        image.resizable().scaledToFill()
                    } else {
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().strokeBorder(.white.opacity(0.18), lineWidth: 0.5))
    }

    private var fallback: some View {
        Image("ProfileAvatar")
            .resizable()
            .scaledToFill()
    }
}
