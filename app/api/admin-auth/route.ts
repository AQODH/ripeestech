import { adminAuthPost } from "../../../lib/admin-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return adminAuthPost(request);
}
