
/**
 * Crystal Pools logo.
 * - "mark": the emblem only, on a white tile — readable at small sizes and on dark backgrounds.
 * - "full": the complete logo with the name and tagline.
 */
export default function Logo({ className = "", variant = "mark" }: { className?: string; variant?: "mark" | "full" }) {
  if (variant === "full") {
    return (
      <div className={`relative ${className}`}>
        <img src="/logo.png" alt="Crystal Pools — Committed to excellence" className="w-full h-full object-contain" />
      </div>
    );
  }
  return (
    <div className={`relative bg-white rounded-xl p-1 shadow-sm ${className}`}>
      <img src="/logo-mark.png" alt="Crystal Pools" className="w-full h-full object-contain" />
    </div>
  );
}
