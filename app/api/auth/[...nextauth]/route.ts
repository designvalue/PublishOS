import { handlers } from "@/lib/auth";
import { withLogging } from "@/lib/logged-handler";

export const GET = withLogging(handlers.GET);
export const POST = withLogging(handlers.POST);
