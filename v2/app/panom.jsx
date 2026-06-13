// Panom kabuğu (iskelet). Task 5'te gridstack + layout + düzenle eklenecek.
function PanomApp() {
  return React.createElement("div", { style: { padding: 16 } },
    React.createElement("h1", { style: { font: "500 22px var(--font-sans)", margin: 0 } }, "Panom"),
    React.createElement("div", { id: "bns-grid", className: "grid-stack" }));
}
window.PanomApp = PanomApp;
