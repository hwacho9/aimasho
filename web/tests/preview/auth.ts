export const useAuth = () => ({ user: { uid: "preview", displayName: "はな", isAnonymous: new URLSearchParams(window.location.search).get("mode") === "guest" }, loading: false, error: null });
