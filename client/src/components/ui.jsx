export function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Alert({ children }) {
  if (!children) return null;
  return (
    <div className="alert" role="alert">
      {children}
    </div>
  );
}

export function Notice({ children }) {
  if (!children) return null;
  return <div className="notice">{children}</div>;
}
