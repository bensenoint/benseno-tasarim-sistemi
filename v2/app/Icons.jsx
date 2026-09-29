// ui_kits/dashboard/Icons.jsx — Lucide-style inline icons, all currentColor.
const Ic = ({ children, size = 16, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="1.5"
       strokeLinecap="round" strokeLinejoin="round" {...rest}>
    {children}
  </svg>
);

const I = {
  Search:  (p) => <Ic {...p}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></Ic>,
  Bell:    (p) => <Ic {...p}><path d="M15 17a3 3 0 0 1-6 0"/><path d="M18 17H6l1.5-3V10a4.5 4.5 0 1 1 9 0v4z"/></Ic>,
  Calendar:(p) => <Ic {...p}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></Ic>,
  Clock:   (p) => <Ic {...p}><path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/></Ic>,
  Grid:    (p) => <Ic {...p}><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></Ic>,
  List:    (p) => <Ic {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></Ic>,
  Columns: (p) => <Ic {...p}><rect x="3" y="4" width="7" height="16" rx="1"/><rect x="14" y="4" width="7" height="16" rx="1"/></Ic>,
  Filter:  (p) => <Ic {...p}><path d="M3 6h18M6 12h12M9 18h6"/></Ic>,
  Plus:    (p) => <Ic {...p}><path d="M12 5v14M5 12h14"/></Ic>,
  Right:   (p) => <Ic {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Ic>,
  Check:   (p) => <Ic {...p}><path d="M20 6 9 17l-5-5"/></Ic>,
  Info:    (p) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/></Ic>,
  Warn:    (p) => <Ic {...p}><path d="M12 3 2 21h20zM12 9v5M12 17h.01"/></Ic>,
  Trash:   (p) => <Ic {...p}><path d="M4 7h16l-1.5 13H5.5zM9 7V4h6v3M10 11v6M14 11v6"/></Ic>,
  Edit:    (p) => <Ic {...p}><path d="M4 20h4l10-10-4-4L4 16zM14 6l4 4"/></Ic>,
  User:    (p) => <Ic {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Ic>,
  Users:   (p) => <Ic {...p}><circle cx="9" cy="9" r="4"/><circle cx="17" cy="13" r="4"/><path d="M3 21a6 6 0 0 1 12 0M11 21a6 6 0 0 1 12 0"/></Ic>,
  Folder:  (p) => <Ic {...p}><path d="M21 7H10l-2 -3H3v15h18z"/></Ic>,
  Link:    (p) => <Ic {...p}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></Ic>,
  Slack:   (p) => <Ic {...p}><rect x="3" y="3" width="4" height="11" rx="2"/><rect x="3" y="17" width="4" height="4" rx="2"/><rect x="17" y="10" width="4" height="11" rx="2"/><rect x="17" y="3" width="4" height="4" rx="2"/><rect x="10" y="3" width="11" height="4" rx="2"/><rect x="3" y="10" width="11" height="4" rx="2" style={{display:'none'}}/></Ic>,
  Refresh: (p) => <Ic {...p}><path d="M3 12a9 9 0 0 1 15-6.7L21 8M21 4v4h-4M21 12a9 9 0 0 1-15 6.7L3 16M3 20v-4h4"/></Ic>,
  More:    (p) => <Ic {...p}><circle cx="6" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18" cy="12" r="1"/></Ic>,
  ChevronDown: (p) => <Ic {...p}><path d="m6 9 6 6 6-6"/></Ic>,
  ChevronRight: (p) => <Ic {...p}><path d="m9 6 6 6-6 6"/></Ic>,
  Up:      (p) => <Ic {...p}><path d="m6 15 6-6 6 6"/></Ic>,
  Down:    (p) => <Ic {...p}><path d="m6 9 6 6 6-6"/></Ic>,
  Spark:   (p) => <Ic {...p}><path d="M3 18l4-7 4 4 5-9 5 8"/></Ic>,
  Dot:     ({size=8, color}) => <span style={{display:"inline-block", width:size, height:size, borderRadius:999, background:color, flexShrink:0}}/>,
  Triangle:({size=9}) => <svg width={size} height={size} viewBox="0 0 9 9" style={{display:"inline-block"}}><path d="M4.5 0 9 9H0z" fill="currentColor"/></svg>,
  Square:  ({size=8}) => <svg width={size} height={size} viewBox="0 0 8 8" style={{display:"inline-block"}}><rect width="8" height="8" fill="currentColor"/></svg>,
  Circle:  ({size=9}) => <svg width={size} height={size} viewBox="0 0 9 9" style={{display:"inline-block"}}><circle cx="4.5" cy="4.5" r="4.5" fill="currentColor"/></svg>,
  CheckMini: ({size=10}) => <svg width={size} height={size} viewBox="0 0 10 10" style={{display:"inline-block"}}><path d="M1 5l3 3 5-6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Mark: ({size=22}) => (
    <svg width={size} height={size} viewBox="0 0 28 28">
      <rect x="3" y="6" width="14" height="4" rx="1" fill="var(--ink)"/>
      <rect x="3" y="12" width="22" height="4" rx="1" fill="var(--ember)"/>
      <rect x="3" y="18" width="18" height="4" rx="1" fill="var(--ink)"/>
    </svg>
  ),
  Sun:     (p) => <Ic {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></Ic>,
  Moon:    (p) => <Ic {...p}><path d="M21 13A9 9 0 0 1 11 3a7 7 0 1 0 10 10z"/></Ic>,
  Command: (p) => <Ic {...p}><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z"/></Ic>,
  Layers:  (p) => <Ic {...p}><path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5M3 18l9 5 9-5"/></Ic>,
  Inbox:   (p) => <Ic {...p}><path d="M3 13h5l1 3h6l1-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/></Ic>,
  Send:    (p) => <Ic {...p}><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></Ic>,
  Tag:     (p) => <Ic {...p}><path d="M3 12V3h9l9 9-9 9z"/><circle cx="7.5" cy="7.5" r="1.5"/></Ic>,
  Star:    (p) => <Ic {...p}><path d="m12 2 3 7 7 1-5 5 1.5 7L12 18l-6.5 4L7 15 2 10l7-1z"/></Ic>,
  StarFill:({size=12, color="currentColor"}) => <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{display:"inline-block"}}><path d="m12 2 3 7 7 1-5 5 1.5 7L12 18l-6.5 4L7 15 2 10l7-1z"/></svg>,
  Image:   (p) => <Ic {...p}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></Ic>,
  Hash:    (p) => <Ic {...p}><path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/></Ic>,
  Pin:     (p) => <Ic {...p}><path d="M12 2v7l4 4-4 7-4-7 4-4V2zM8 9h8"/></Ic>,
  Bot:     (p) => <Ic {...p}><rect x="3" y="9" width="18" height="12" rx="2"/><path d="M12 5v4M8 9V5M16 9V5"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></Ic>,
  Pencil:  (p) => <Ic {...p}><path d="m12 20 8-8-4-4-8 8v4z"/><path d="M14 6l4 4"/></Ic>,
  Brush:   (p) => <Ic {...p}><path d="M7 21c1 0 3-2 3-3v-3l8-8a2.8 2.8 0 0 0-4-4l-8 8H3v3c0 1 2 3 3 3"/></Ic>,
  ArrowR:  (p) => <Ic {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Ic>,
  X:       (p) => <Ic {...p}><path d="M6 6l12 12M18 6 6 18"/></Ic>,
  Move:    (p) => <Ic {...p}><path d="M9 18l-3 3-3-3M3 21V3M3 6l3-3 3 3M21 6l-3-3-3 3M18 3v18M15 18l3 3 3-3M6 9 3 12l3 3M18 15l3-3-3-3M3 12h18"/></Ic>,
  TrendUp: (p) => <Ic {...p}><path d="m3 17 6-6 4 4 8-8M14 7h7v7"/></Ic>,
  TrendDn: (p) => <Ic {...p}><path d="m3 7 6 6 4-4 8 8M14 17h7v-7"/></Ic>,
  Cap:     (p) => <Ic {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></Ic>,
  LogOut:  (p) => <Ic {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></Ic>,
};

window.I = I;
window.Ic = Ic;
