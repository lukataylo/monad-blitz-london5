// The old "Join the club" name+email sheet grew into full onboarding
// (create account / log in / stay anonymous) with a deterministic
// email+password wallet. Same public contract — onSaved(profile) continues
// the caller's pending action, onClose dismisses — so existing call sites
// (JoinView etc.) keep working unchanged via this re-export.
export { OnboardingModal as ProfileModal } from "../onboarding/OnboardingModal";
