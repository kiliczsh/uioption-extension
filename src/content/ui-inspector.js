(() => {
	if (window.__uioptionInspectorLoaded) return;
	window.__uioptionInspectorLoaded = true;

	// ── Framework Detection ──────────────────────────────────────────────────

	function getReactInfo(el) {
		let current = el;
		while (current) {
			const fiberKey = Object.keys(current).find(
				(k) =>
					k.startsWith("__reactFiber$") ||
					k.startsWith("__reactInternalInstance$"),
			);
			if (fiberKey) {
				const names = [];
				let leafSource = null;
				let fiber = current[fiberKey];

				while (fiber) {
					const type = fiber.type;
					if (type && typeof type === "function") {
						const name = type.displayName || type.name;
						if (
							name &&
							name !== "Fragment" &&
							!name.startsWith("_") &&
							!names.includes(name)
						) {
							if (names.length === 0) leafSource = fiber._debugSource || null;
							names.push(name); // innermost first
							if (names.length >= 3) break;
						}
					}
					fiber = fiber.return;
				}

				if (names.length) {
					return {
						framework: "React",
						component:
							names.length > 1 ? names.slice().reverse().join(" > ") : names[0],
						file: leafSource?.fileName ?? null,
						line: leafSource?.lineNumber ?? null,
					};
				}
			}
			current = current.parentElement;
		}
		return null;
	}

	function getVue3Info(el) {
		let current = el;
		while (current) {
			if (current.__vueParentComponent) {
				const type = current.__vueParentComponent.type;
				return {
					framework: "Vue",
					component: type.name || type.__name || type.__hmrId || null,
					file: type.__file || null,
					line: null,
				};
			}
			current = current.parentElement;
		}
		return null;
	}

	function getVue2Info(el) {
		let current = el;
		while (current) {
			if (current.__vue__) {
				const opts = current.__vue__.$options;
				return {
					framework: "Vue 2",
					component: opts.name || opts._componentTag || null,
					file: opts.__file || null,
					line: null,
				};
			}
			current = current.parentElement;
		}
		return null;
	}

	function getAngularInfo(el) {
		if (!window.ng) return null;
		let current = el;
		while (current) {
			try {
				const comp =
					window.ng.getComponent?.(current) ||
					window.ng.getOwningComponent?.(current);
				if (comp) {
					return {
						framework: "Angular",
						component: comp.constructor?.name || null,
						file: null,
						line: null,
					};
				}
			} catch {}
			current = current.parentElement;
		}
		return null;
	}

	function getSvelteInfo(el) {
		let current = el;
		while (current) {
			if (current.__svelte_meta) {
				const loc = current.__svelte_meta.loc;
				return {
					framework: "Svelte",
					component: null,
					file: loc?.file || null,
					line: loc?.line || null,
				};
			}
			current = current.parentElement;
		}
		return null;
	}

	function getHTMLInfo(el) {
		const tag = el.tagName.toLowerCase();
		const id = el.id ? `#${el.id}` : "";
		return {
			framework: "HTML",
			component: id ? `${tag}${id}` : null,
			file: null,
			line: null,
		};
	}

	// ── Context Helpers ──────────────────────────────────────────────────────

	function getNearestHeading(el) {
		let current = el.parentElement;
		let depth = 0;
		while (current && current !== document.body && depth < 5) {
			let sibling = current.previousElementSibling;
			while (sibling) {
				const h = sibling.matches("h1,h2,h3,h4,h5,h6")
					? sibling
					: sibling.querySelector("h1,h2,h3,h4,h5,h6");
				if (h) {
					const text = (h.innerText || h.textContent || "")
						.trim()
						.replace(/\s+/g, " ");
					if (text && text.length < 80) return text;
				}
				sibling = sibling.previousElementSibling;
			}
			current = current.parentElement;
			depth++;
		}
		return null;
	}

	const LANDMARK_TAGS = new Set([
		"header",
		"nav",
		"main",
		"footer",
		"section",
		"article",
		"aside",
		"form",
		"dialog",
	]);

	function getSemanticPath(el) {
		let landmark = el.parentElement;
		while (
			landmark &&
			landmark !== document.body &&
			!LANDMARK_TAGS.has(landmark.tagName.toLowerCase())
		) {
			landmark = landmark.parentElement;
		}

		if (!landmark || landmark === document.body) {
			return el.tagName.toLowerCase();
		}

		const path = [];
		let node = el;
		while (node && node !== landmark) {
			const tag = node.tagName.toLowerCase();
			if (node.id) {
				path.unshift(`${tag}#${node.id}`);
			} else {
				const parent = node.parentElement;
				const sameSiblings = parent
					? [...parent.children].filter((s) => s.tagName === node.tagName)
					: [];
				if (sameSiblings.length > 1) {
					path.unshift(`${tag}:nth-of-type(${sameSiblings.indexOf(node) + 1})`);
				} else {
					path.unshift(tag);
				}
			}
			node = node.parentElement;
		}

		const ltag = landmark.tagName.toLowerCase();
		const lid = landmark.id ? `#${landmark.id}` : "";
		const laria =
			!lid && landmark.getAttribute("aria-label")
				? `[aria-label="${landmark.getAttribute("aria-label")}"]`
				: "";

		return [`${ltag}${lid || laria}`, ...path.slice(0, 3)].join(" > ");
	}

	function detect(el) {
		return (
			getReactInfo(el) ||
			getVue3Info(el) ||
			getVue2Info(el) ||
			getAngularInfo(el) ||
			getSvelteInfo(el) ||
			getHTMLInfo(el)
		);
	}

	// ── Selector Builder ────────────────────────────────────────────────────

	function buildSelector(el) {
		if (el.id) return `#${el.id}`;

		// data-testid first, then any other data-* attribute with a short value
		for (const [key, val] of Object.entries(el.dataset)) {
			if (val && val.length < 80) return `[data-${key}="${val}"]`;
		}

		const ariaLabel = el.getAttribute("aria-label");
		if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

		const role = el.getAttribute("role");

		// Filter out generated/hashed class names (e.g. "x3k2a", "css-1abc23")
		const meaningful = [...el.classList].filter(
			(c) => /[a-zA-Z]{3,}/.test(c) && !/^(css|sc|_)-/.test(c) && c.length < 40,
		);
		if (meaningful.length) {
			const tag = el.tagName.toLowerCase();
			const cls = meaningful
				.slice(0, 2)
				.map((c) => `.${c}`)
				.join("");
			return role ? `${tag}${cls}[role="${role}"]` : `${tag}${cls}`;
		}

		const tag = el.tagName.toLowerCase();
		return role ? `${tag}[role="${role}"]` : tag;
	}

	// ── Formatting ───────────────────────────────────────────────────────────

	function isUniqueSelector(selector) {
		return (
			selector.startsWith("#") ||
			selector.startsWith("[data-") ||
			selector.startsWith("[aria-")
		);
	}

	const LABEL_TAGS = new Set([
		"button",
		"a",
		"label",
		"option",
		"h1",
		"h2",
		"h3",
		"h4",
		"h5",
		"h6",
		"li",
		"th",
		"td",
	]);

	function getTextSnippet(el) {
		if (!LABEL_TAGS.has(el.tagName.toLowerCase())) return "";
		if (el.children.length > 0) return "";
		const text = (el.innerText || el.textContent || "")
			.trim()
			.replace(/\s+/g, " ");
		if (!text || text.length > 40) return "";
		return text;
	}

	function formatClipboard(info, selector, el) {
		const parts = [];

		if (info.component) {
			parts.push(`Component: ${info.component}`);
			if (info.file) {
				parts.push(
					`File: ${info.line ? `${info.file}:${info.line}` : info.file}`,
				);
			}
			if (isUniqueSelector(selector)) parts.push(`Selector: ${selector}`);
		} else {
			// HTML / no framework — use structural context
			if (isUniqueSelector(selector)) {
				parts.push(`Selector: ${selector}`);
			} else {
				const heading = getNearestHeading(el);
				if (heading) parts.push(`Section: "${heading}"`);
				parts.push(`Path: ${getSemanticPath(el)}`);
			}
		}

		const text = getTextSnippet(el);
		if (text) parts.push(`Text: "${text}"`);

		return parts.join("\n");
	}

	function formatLabel(info, selector, el) {
		if (info.component) {
			const leaf = info.component.split(" > ").pop();
			if (isUniqueSelector(selector)) return `${leaf} · ${selector}`;
			if (info.file)
				return `${leaf} — ${info.file.split("/").pop()}${info.line ? `:${info.line}` : ""}`;
			return leaf;
		}
		if (isUniqueSelector(selector)) return selector;
		const heading = getNearestHeading(el);
		return heading ? `"${heading.slice(0, 40)}"` : getSemanticPath(el);
	}

	// ── Inspector UI (Shadow DOM) ────────────────────────────────────────────

	const host = document.createElement("uioption-inspector");
	host.style.cssText =
		"position:fixed;top:0;left:0;pointer-events:none;z-index:2147483646;";

	const shadow = host.attachShadow({ mode: "open" });
	shadow.innerHTML = `
    <style>
      .highlight {
        position: fixed;
        pointer-events: none;
        background: rgba(59,130,246,0.1);
        outline: 2px solid rgba(59,130,246,0.85);
        border-radius: 2px;
        box-sizing: border-box;
        display: none;
      }
      .label {
        position: fixed;
        pointer-events: none;
        background: rgba(37,99,235,0.95);
        color: #fff;
        font-family: ui-monospace, 'Cascadia Code', 'Fira Code', monospace;
        font-size: 11px;
        font-weight: 500;
        padding: 2px 7px;
        border-radius: 3px;
        white-space: nowrap;
        max-width: 340px;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 20px;
        display: none;
        box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      }
      .toast {
        position: fixed;
        bottom: 72px;
        left: 50%;
        transform: translateX(-50%);
        background: #22c55e;
        color: #fff;
        font-family: ui-sans-serif, system-ui, sans-serif;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 16px;
        border-radius: 20px;
        white-space: nowrap;
        opacity: 0;
        transition: opacity 180ms;
        pointer-events: none;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .toast.show { opacity: 1; }
    </style>
    <div class="highlight" id="hl"></div>
    <div class="label" id="lbl"></div>
    <div class="toast" id="toast">Copied to clipboard</div>
  `;

	const hl = shadow.getElementById("hl");
	const lbl = shadow.getElementById("lbl");
	const toast = shadow.getElementById("toast");
	let toastTimer = null;

	function showToast() {
		toast.classList.add("show");
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.classList.remove("show"), 1500);
	}

	function updateHighlight(el) {
		const rect = el.getBoundingClientRect();
		hl.style.top = `${rect.top}px`;
		hl.style.left = `${rect.left}px`;
		hl.style.width = `${rect.width}px`;
		hl.style.height = `${rect.height}px`;
		hl.style.display = "block";

		const info = detect(el);
		const selector = buildSelector(el);
		lbl.textContent = formatLabel(info, selector, el);
		lbl.style.display = "block";

		const labelH = 24;
		const topAbove = rect.top - labelH - 4;
		lbl.style.top = `${topAbove >= 0 ? topAbove : rect.bottom + 4}px`;
		lbl.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 350))}px`;
	}

	// ── Event Handlers ───────────────────────────────────────────────────────

	function isInspectorEl(el) {
		return (
			el.closest?.("uioption-inspector") || el.closest?.("uioption-picker")
		);
	}

	function onMouseMove(e) {
		if (isInspectorEl(e.target)) return;
		updateHighlight(e.target);
	}

	function onClick(e) {
		if (isInspectorEl(e.target)) return;
		e.preventDefault();
		e.stopPropagation();

		const info = detect(e.target);
		const selector = buildSelector(e.target);
		navigator.clipboard
			.writeText(formatClipboard(info, selector, e.target))
			.then(showToast);
	}

	// ── Mount & Cleanup ──────────────────────────────────────────────────────

	document.addEventListener("mousemove", onMouseMove, true);
	document.addEventListener("click", onClick, true);
	document.documentElement.appendChild(host);

	window.__uioptionInspectorCleanup = () => {
		document.removeEventListener("mousemove", onMouseMove, true);
		document.removeEventListener("click", onClick, true);
		host.remove();
		window.__uioptionInspectorLoaded = false;
		delete window.__uioptionInspectorCleanup;
	};
})();
