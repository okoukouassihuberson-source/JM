"use client";
import { issueResetCodeAction, setRoleAction, toggleUserAction } from "@/actions/admin-ops";
import { displayPhone, fcfa, fmtDateTime } from "@/lib/format";
import { ActionButton } from "../ui/ActionForm";
import { useToast } from "../ui/Toast";

export function UserRow({ r, staff, roles, canRole, canReset, canToggle }: { r: any; staff: boolean; roles: { key: string; label: string }[]; canRole: boolean; canReset: boolean; canToggle: boolean }) {
  const toast = useToast();
  return (
    <tr className={r.active ? "" : "bg-slate-50 opacity-60"}>
      <td className="td"><b className="text-navy-900">{r.first_name} {r.last_name}</b></td>
      <td className="td">{displayPhone(r.phone)}</td>
      <td className="td">{staff ? (canRole ? <select defaultValue={r.role_key} className="input !min-h-9 !w-auto !py-1 text-xs" onChange={async (e) => { const x = await setRoleAction(r.id, e.target.value); toast(x.error ?? x.message ?? "OK", x.error ? "error" : "success"); }}>{roles.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select> : <span className="badge bg-navy-900 text-white">{r.role_label}</span>) : `${r.orders} commande(s)`}</td>
      <td className="td text-sm">{staff ? (r.last_login_at ? fmtDateTime(r.last_login_at) : "Jamais") : fcfa(r.spent)}</td>
      <td className="td"><span className={`badge ${r.active ? "bg-success-50 text-success-600" : "bg-slate-200 text-slate-600"}`}>{r.active ? "Actif" : "Désactivé"}</span></td>
      <td className="td whitespace-nowrap text-right"><div className="flex justify-end gap-1">
        {canReset && <ActionButton action={() => issueResetCodeAction(r.id)} className="btn-outline btn-sm" successToast>Code de réinitialisation</ActionButton>}
        {canToggle && <ActionButton action={() => toggleUserAction(r.id)} confirm={r.active ? "Désactiver ce compte ?" : undefined} className="btn-outline btn-sm">{r.active ? "Désactiver" : "Réactiver"}</ActionButton>}</div></td>
    </tr>
  );
}
