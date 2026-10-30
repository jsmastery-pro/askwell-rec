// widget.js: `<script src="<app>/widget.js" data-key="pk_..."></script>` on the customer's site.
import { mount } from "./loader";

// `currentScript` is only set while this file first runs, so read it now.
void mount(document.currentScript);
