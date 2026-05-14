import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/data/users";
import ChangePasswordForm from "@/components/account/ChangePasswordForm";

export const dynamic = "force-dynamic";

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const me = await getUserById(session.user.id);
  if (!me) redirect("/login");

  return (
    <main className="page page-narrow">
      <div className="head">
        <div>
          <p className="eyebrow">Account</p>
          <h1 className="title">
            Change <span className="it">password</span>
          </h1>
          <p className="sub">
            {me.mustChangePassword
              ? "An admin reset your password. Pick a new one to continue."
              : "Choose a new password for signing into PublishOS."}
          </p>
        </div>
      </div>
      <ChangePasswordForm mustChange={me.mustChangePassword} />
    </main>
  );
}
