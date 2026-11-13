export default function Brand({ linked = true }: { linked?: boolean }) {
  const logo = (
    <>
      <svg width="30" height="30" viewBox="0 0 64 64" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3 6l18 8 9 19-9-5 8 15v13L8 30l7 3-9-16 8 4zM61 6l-18 8-9 19 9-5-8 15v13l21-26-7 3 9-16-8 4zM32 44l5 9-5 9-5-9z"
        />
        <path className="brandGem" d="m32 2 6 11-6 11-6-11z" />
      </svg>
      <span>Vestiquay</span>
    </>
  );
  return linked ? (
    <a className="wordmark" href="/">
      {logo}
    </a>
  ) : (
    <span className="wordmark">{logo}</span>
  );
}
