// Re-mounts on every navigation, so each screen rises gently into place.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-enter">{children}</div>;
}
