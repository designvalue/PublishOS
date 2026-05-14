import Link from "next/link";

export default function MustChangePasswordBanner() {
  return (
    <div className="must-change-banner">
      <div className="must-change-inner">
        <span>An admin reset your password. Please choose a new one.</span>
        <Link href="/account/password" className="btn btn-primary">
          Change password
        </Link>
      </div>
    </div>
  );
}
