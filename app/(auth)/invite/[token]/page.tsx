import Link from "next/link";
import { getInvitationByToken } from "@/lib/data/invitations";
import InviteAcceptForm from "@/components/people/InviteAcceptForm";

export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    return (
      <main className="login-view">
        <div className="login-card">
          <h1 className="login-title">Invitation unavailable</h1>
          <p className="login-tagline">This link has expired or has already been used.</p>
          <Link href="/login" className="btn btn-primary login-btn" style={{ marginTop: 24 }}>
            Go to sign in
          </Link>
        </div>
      </main>
    );
  }

  return <InviteAcceptForm token={token} email={invitation.email} role={invitation.role} />;
}
