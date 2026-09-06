import { handleClientCredentialsRequest } from "@/lib/oauthTokenHandlers";

export async function POST(request: Request) {
  return handleClientCredentialsRequest(request, "auth0");
}
