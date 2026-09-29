export default function BrandLogo({ className = "" }: { className?: string }) {
  // Display only the artwork inside the original 1920 × 1080 transparent canvas.
  // The supplied raster files remain unchanged; both versions use identical bounds.
  return (
    <span className={`brand-logo ${className}`} role="img" aria-label="Scopuly">
      <svg className="logo-light" viewBox="276 391 1360 300" aria-hidden="true">
        <image
          href={`${import.meta.env.BASE_URL}brand/scopuly-light.png`}
          width="1920"
          height="1080"
        />
      </svg>
      <svg className="logo-dark" viewBox="276 391 1360 300" aria-hidden="true">
        <image
          href={`${import.meta.env.BASE_URL}brand/scopuly-dark.png`}
          width="1920"
          height="1080"
        />
      </svg>
    </span>
  );
}
