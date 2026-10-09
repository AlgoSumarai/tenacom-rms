import Image from "next/image";

export function BrandLogo() {
  return (
    <span className="brand-logo">
      <Image
        src="/branding/tenacom.png"
        alt="Tenacom"
        width={1254}
        height={1254}
        sizes="(max-width: 760px) 176px, 256px"
        className="brand-logo-image"
        priority
      />
    </span>
  );
}
