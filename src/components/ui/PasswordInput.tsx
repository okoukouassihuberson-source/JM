"use client";
import { useState, type InputHTMLAttributes } from "react";
import { Icon } from "./Icon";

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? "text" : "password"} className="input pr-12" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center text-muted hover:text-navy-900" aria-label={show ? "Masquer le mot de passe" : "Afficher le mot de passe"}><Icon name="eye" size={19} /></button>
    </div>
  );
}
