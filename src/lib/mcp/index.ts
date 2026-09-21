import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getDashboardPreferencesTool from "./tools/get-dashboard-preferences";
import getLatestWorkbookTool from "./tools/get-latest-workbook";
import getProfileTool from "./tools/get-profile";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "painel-de-sell-out",
  title: "Painel de Sell Out",
  version: "0.1.0",
  instructions:
    "Ferramentas somente leitura do Painel de Sell Out. Use-as para consultar o perfil aprovado, as configurações e metas pessoais e os metadados da última planilha compartilhada.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getProfileTool, getDashboardPreferencesTool, getLatestWorkbookTool],
});