import { useState } from "react";

const members = [
  { name: "Maya", background: "#d6ede3", shirt: "#357865", skin: "#c88862" },
  { name: "Alex", background: "#e2def4", shirt: "#7860a1", skin: "#edb38c" },
  { name: "Sam", background: "#fae2cf", shirt: "#b56947", skin: "#8a533d" },
];

function avatarSource(member: typeof members[number]) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><rect width="56" height="56" rx="28" fill="${member.background}"/><path d="M7 56c0-23 42-23 42 0" fill="${member.shirt}"/><ellipse cx="28" cy="25" rx="12" ry="15" fill="${member.skin}"/><path d="M16 24c-5-21 28-23 25 0-4-1-7-7-8-11-3 7-10 10-17 11" fill="#302a32"/><path d="M23 32q5 4 10 0" fill="none" stroke="#51392f" stroke-width="2" stroke-linecap="round"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function TeamUpdate() {
  const [showNames, setShowNames] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-start" }}>
      <div style={{ display: "flex", paddingLeft: 6 }}>
        {members.map((member) => (
          <img key={member.name} src={avatarSource(member)} alt={`${member.name}'s avatar`} width={28} height={28}
            style={{ display: "block", width: 28, height: 28, marginLeft: -6, borderRadius: "50%", boxShadow: "0 0 0 2px #fff" }} />
        ))}
      </div>
      <span>3 new members joined the project.</span>
      <button type="button" aria-expanded={showNames} onClick={() => setShowNames((value) => !value)}
        style={{ font: "inherit", fontSize: 12, color: "inherit", background: "transparent", border: "1px solid currentColor", borderRadius: 6, padding: "5px 9px", cursor: "pointer" }}>
        {showNames ? "Hide member names" : "Show member names"}
      </button>
      <div aria-live="polite" style={{ display: showNames ? "block" : "none" }}>
        {showNames ? "Welcome Maya, Alex, and Sam." : ""}
      </div>
    </div>
  );
}
