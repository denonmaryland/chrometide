// Put a world from Chrometide on any page:
//
//   <script src="https://…/embed.js" async></script>
//   <chrometide-world code="w2.…" width="640" height="400" autorotate></chrometide-world>
//
// code        the world's share code (the part after #w= in a share link). Required.
// width       a number (pixels) or any CSS length. Default: the full width of the page column.
// height      a number (pixels) or any CSS length. Default: 5/8 of the width.
// autorotate  turn slowly; autorotate="2" turns twice as fast.
// quality     draft, good, fine or premium: how sharp the picture gets when it is still.
// name        what screen readers call the frame. Default: "A world made with Chrometide".
//
// The element only adds a frame pointing at embed.html, found next to this script.
;(() => {
  if (typeof customElements === "undefined" || customElements.get("chrometide-world")) return
  const me = document.currentScript || [...document.querySelectorAll("script[src]")].find((s) => /(^|\/)embed\.js(\?|#|$)/.test(s.src))
  const page = new URL("embed.html", (me && me.src) || location.href)
  const length = (v) => (v == null || v === "" ? "" : /^\d+(\.\d+)?$/.test(v) ? v + "px" : v)

  class ChrometideWorld extends HTMLElement {
    static get observedAttributes() { return ["code", "width", "height", "autorotate", "quality", "name"] }
    constructor() {
      super()
      const root = this.attachShadow({ mode: "open" })
      root.innerHTML = '<style>:host{display:block;position:relative;width:100%;max-width:100%;aspect-ratio:8/5;border-radius:10px;overflow:hidden;background:#101014}iframe{position:absolute;inset:0;width:100%;height:100%;border:0;display:block}</style><iframe loading="lazy" allow="fullscreen" referrerpolicy="no-referrer"></iframe>'
      this.frame = root.querySelector("iframe")
    }
    connectedCallback() { this.update() }
    attributeChangedCallback() { if (this.isConnected) this.update() }
    update() {
      const w = length(this.getAttribute("width")), h = length(this.getAttribute("height"))
      this.style.width = w; this.style.height = h; this.style.aspectRatio = h ? "auto" : ""
      const code = (this.getAttribute("code") || "").trim().replace(/^.*#w=/, "")
      const q = new URLSearchParams()
      if (this.hasAttribute("autorotate")) q.set("autorotate", this.getAttribute("autorotate") || "")
      if (this.getAttribute("quality")) q.set("quality", this.getAttribute("quality"))
      const url = new URL(page); url.search = q.toString().replace(/=(&|$)/g, "$1"); url.hash = code ? "w=" + code : ""
      if (this.frame.src !== url.href) this.frame.src = url.href
      this.frame.title = this.getAttribute("name") || "A world made with Chrometide"
    }
  }
  customElements.define("chrometide-world", ChrometideWorld)
})()
