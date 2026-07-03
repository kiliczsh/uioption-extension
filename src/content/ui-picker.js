(() => {
	if (window.__uioptionPickerLoaded) return;
	window.__uioptionPickerLoaded = true;

	const PICK_SELECTOR = "[data-uioption-pick]";
	const OPTION_SELECTOR = "[data-uioption-option]";
	const ELEMENT_NAME = "uioption-picker";

	function labelOrFallback(value, fallback) {
		const trimmed = value?.trim() ?? "";
		return trimmed.length > 0 ? trimmed : fallback;
	}

	function scanPickerGroup() {
		const container = document.querySelector(PICK_SELECTOR);
		if (!container) return null;

		const options = [];
		let count = 0;

		for (const el of container.querySelectorAll(OPTION_SELECTOR)) {
			if (el.closest(PICK_SELECTOR) !== container) continue;
			count += 1;
			options.push({
				label: labelOrFallback(
					el.getAttribute("data-uioption-option"),
					`Option ${count}`,
				),
				element: el,
			});
		}

		return {
			label: labelOrFallback(
				container.getAttribute("data-uioption-pick"),
				"Decision 1",
			),
			options,
		};
	}

	function getActiveIndex(group) {
		return Math.max(
			0,
			group.options.findIndex((opt) => !opt.element.hidden),
		);
	}

	// Show the first non-hidden option, hide the rest. Used on init/reset.
	function showFirstVisible(group) {
		if (group.options.length === 0) return false;

		const active =
			group.options.find((opt) => !opt.element.hidden) ?? group.options[0];
		let changed = false;

		for (const opt of group.options) {
			const shouldHide = opt !== active;
			if (opt.element.hidden !== shouldHide) {
				opt.element.hidden = shouldHide;
				changed = true;
			}
			if (opt.element.hidden) {
				opt.element.style.display = "none";
			} else {
				opt.element.style.removeProperty("display");
			}
		}

		return changed;
	}

	// Show a specific option, hide all others.
	function selectOption(group, target) {
		let changed = false;

		for (const opt of group.options) {
			const shouldHide = opt !== target;
			if (opt.element.hidden !== shouldHide) {
				opt.element.hidden = shouldHide;
				changed = true;
			}
			if (opt.element.hidden) {
				opt.element.style.display = "none";
			} else {
				opt.element.style.removeProperty("display");
			}
		}

		return changed;
	}

	function isPickerRelated(node) {
		if (!(node instanceof Element)) return false;
		if (node.matches(PICK_SELECTOR) || node.matches(OPTION_SELECTOR))
			return true;
		return (
			node.querySelector(PICK_SELECTOR) !== null ||
			node.querySelector(OPTION_SELECTOR) !== null
		);
	}

	// --- Custom element ---

	const SHADOW_HTML = `
    <style>
      :host {
        position: fixed;
        left: 50%;
        bottom: 16px;
        transform: translateX(-50%);
        display: block;
        width: auto;
        max-width: calc(100vw - 16px);
        z-index: 2147483647;
        color: #ffffff;
        font-family: ui-sans-serif, system-ui, sans-serif;
        line-height: 1;
        user-select: none;
        -webkit-user-select: none;
      }

      *, *::before, *::after {
        box-sizing: border-box;
      }

      dialog {
        display: block;
        position: static;
        inset: auto;
        margin: 0;
        padding: 0;
        border: 0;
        width: 100%;
        max-width: none;
        background: transparent;
        color: inherit;
        overflow: visible;
        outline: none;
      }

      [data-panel] {
        display: grid;
        grid-template-columns: auto auto 1fr auto auto auto;
        align-items: stretch;
        min-width: 16rem;
        height: 40px;
        border-radius: 12px;
        padding: 4px;
        background: rgba(10, 10, 10, 0.8);
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.9),
          inset 0 0 0 1px rgba(255, 255, 255, 0.1),
          0 25px 50px -12px rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        cursor: default;
      }

      [data-drag-handle] {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 32px;
        color: rgba(255, 255, 255, 0.25);
        cursor: grab;
        flex-shrink: 0;
        transition: color 120ms ease;
        touch-action: none;
      }

      [data-drag-handle]:hover {
        color: rgba(255, 255, 255, 0.6);
      }

      [data-dragging] [data-drag-handle] {
        cursor: grabbing;
      }

      [data-nav] {
        width: 32px;
        height: 32px;
        border: 0;
        border-radius: 8px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        color: #a3a3a3;
        background: transparent;
        cursor: pointer;
        transition: color 120ms ease, background-color 120ms ease, opacity 120ms ease;
        flex-shrink: 0;
      }

      [data-nav]:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
      }

      [data-nav]:focus-visible {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.1);
        outline: none;
      }

      [data-nav]:disabled {
        opacity: 0.45;
        cursor: default;
      }

      [data-divider-wrap] {
        display: flex;
        align-items: center;
        padding: 0 4px;
      }

      [data-divider] {
        width: 1px;
        height: 16px;
        background: rgba(255, 255, 255, 0.12);
      }

      [data-center] {
        position: relative;
        min-width: 0;
        border-radius: 8px;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0 8px;
        color: #ffffff;
        cursor: pointer;
        transition: background-color 120ms ease;
      }

      [data-center]:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      [data-center]:focus-within {
        background: rgba(255, 255, 255, 0.1);
      }

      [data-meta] {
        min-width: 0;
        flex: 1;
        display: flex;
        align-items: baseline;
        gap: 8px;
      }

      [data-position] {
        flex-shrink: 0;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 12px;
        color: rgba(255, 255, 255, 0.5);
      }

      [data-select] {
        min-width: 0;
        flex: 1;
        border: 0;
        outline: none;
        color: #ffffff;
        background: transparent;
        appearance: none;
        font-size: 13px;
        font-weight: 500;
        text-align: center;
        white-space: nowrap;
        text-overflow: ellipsis;
        overflow: hidden;
        padding-right: 18px;
        cursor: pointer;
      }

      [data-select]:disabled {
        cursor: default;
        color: rgba(255, 255, 255, 0.6);
      }

      [data-select]:focus-visible {
        outline: none;
      }

      [data-chevron] {
        position: absolute;
        right: 8px;
        width: 14px;
        height: 14px;
        color: #737373;
        pointer-events: none;
        transform: rotate(180deg);
        transition: transform 120ms ease;
      }

      [data-empty] {
        color: rgba(255, 255, 255, 0.5);
      }

      /* Minimized state */
      [data-collapsed] {
        display: none;
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: 0;
        padding: 0;
        align-items: center;
        justify-content: center;
        background: rgba(10, 10, 10, 0.8);
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.9),
          inset 0 0 0 1px rgba(255, 255, 255, 0.1),
          0 8px 24px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        cursor: pointer;
        color: #a3a3a3;
        transition: color 120ms ease, background-color 120ms ease;
      }

      [data-collapsed]:hover {
        color: #ffffff;
        background: rgba(20, 20, 20, 0.9);
      }

      :host([data-minimized]) dialog {
        display: none;
      }

      :host([data-minimized]) [data-collapsed] {
        display: inline-flex;
      }

      /* Features layout mode */
      [data-features-panel] {
        display: none;
        flex-direction: column;
        gap: 8px;
        min-width: 320px;
        max-width: min(680px, calc(100vw - 32px));
        border-radius: 16px;
        padding: 12px;
        background: rgba(10, 10, 10, 0.88);
        box-shadow:
          0 0 0 1px rgba(0, 0, 0, 0.9),
          inset 0 0 0 1px rgba(255, 255, 255, 0.1),
          0 25px 50px -12px rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
      }

      [data-features-header] {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 2px 4px 6px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        margin-bottom: 2px;
      }

      [data-features-label] {
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(255, 255, 255, 0.4);
        letter-spacing: 0.04em;
      }

      [data-features-compact] {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border: 0;
        border-radius: 6px;
        background: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
        font-family: ui-sans-serif, system-ui, sans-serif;
        cursor: pointer;
        transition: background 120ms, color 120ms;
      }

      [data-features-compact]:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
      }

      [data-features-grid] {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 6px;
      }

      [data-feature-card] {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 10px 12px 12px;
        border-radius: 10px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(255, 255, 255, 0.04);
        cursor: pointer;
        transition: background 120ms, border-color 120ms;
        text-align: left;
      }

      [data-feature-card]:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.16);
      }

      [data-feature-card][data-active] {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.25);
      }

      [data-feature-card][data-active] [data-card-num] {
        color: #a3e635;
      }

      [data-card-num] {
        font-size: 11px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: rgba(255, 255, 255, 0.3);
        line-height: 1;
      }

      [data-card-name] {
        font-size: 12px;
        font-weight: 500;
        color: rgba(255, 255, 255, 0.85);
        line-height: 1.3;
        word-break: break-word;
      }

      :host([data-features]) dialog {
        display: none;
      }

      :host([data-features]) [data-features-panel] {
        display: flex;
      }

      @media (max-width: 640px) {
        :host {
          left: 8px;
          bottom: 8px;
          transform: none;
          max-width: calc(100vw - 16px);
        }

        [data-panel] {
          min-width: calc(100vw - 16px);
        }

        [data-features-panel] {
          min-width: calc(100vw - 32px);
        }
      }
    </style>

    <dialog aria-label="UI picker" tabindex="-1">
      <section data-panel>
        <div data-drag-handle aria-hidden="true">
          <svg viewBox="0 0 6 10" fill="currentColor" width="6" height="10" aria-hidden="true">
            <circle cx="1.5" cy="1.5" r="1.5"/>
            <circle cx="4.5" cy="1.5" r="1.5"/>
            <circle cx="1.5" cy="5" r="1.5"/>
            <circle cx="4.5" cy="5" r="1.5"/>
            <circle cx="1.5" cy="8.5" r="1.5"/>
            <circle cx="4.5" cy="8.5" r="1.5"/>
          </svg>
        </div>
        <button type="button" data-nav data-previous aria-label="Previous option">
          <svg viewBox="0 0 5 6" fill="currentColor" width="5" height="6" aria-hidden="true">
            <path d="M0.75 3L4.25 5.25L4.25 0.75L0.75 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </button>
        <div data-center>
          <span data-meta>
            <span data-position>0/0</span>
            <select data-select aria-label="Select option"></select>
          </span>
          <svg viewBox="0 0 16 16" fill="currentColor" data-chevron aria-hidden="true">
            <path fill-rule="evenodd" d="M4.22 6.22a.75.75 0 0 1 1.06 0L8 8.94l2.72-2.72a.75.75 0 1 1 1.06 1.06l-3.25 3.25a.75.75 0 0 1-1.06 0L4.22 7.28a.75.75 0 0 1 0-1.06Z" clip-rule="evenodd" />
          </svg>
        </div>
        <button type="button" data-nav data-next aria-label="Next option">
          <svg viewBox="0 0 5 6" fill="currentColor" width="5" height="6" aria-hidden="true">
            <path d="M4.25 3L0.75 5.25L0.75 0.75L4.25 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
          </svg>
        </button>
        <div data-divider-wrap><div data-divider></div></div>
        <button type="button" data-nav data-minimize aria-label="Minimize picker">
          <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10" aria-hidden="true">
            <path d="M2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Z"/>
          </svg>
        </button>
      </section>
    </dialog>

    <div data-features-panel>
      <div data-features-header>
        <span data-features-label></span>
        <button type="button" data-features-compact aria-label="Switch to compact mode">
          <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10" aria-hidden="true">
            <path d="M2 4.75A.75.75 0 0 1 2.75 4h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75ZM2 8a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 8Zm0 3.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z"/>
          </svg>
          compact
        </button>
      </div>
      <div data-features-grid></div>
    </div>

    <button type="button" data-collapsed aria-label="Expand picker">
      <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" aria-hidden="true">
        <rect width="16" height="16" rx="4" fill="currentColor" opacity="0.15"/>
        <path d="M3.5 5h3M3.5 8h9M3.5 11h6.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        <circle cx="10" cy="5" r="1.5" fill="#a3e635"/>
      </svg>
    </button>
  `;

	class UioptionPicker extends HTMLElement {
		root;
		dialog;
		previousButton;
		nextButton;
		center;
		positionText;
		select;
		minimizeButton;
		collapsedButton;
		featuresPanel;
		featuresLabel;
		featuresGrid;
		featuresCompactButton;
		group = null;
		onSelect = null;

		// drag state
		_dragging = false;
		_dragOffsetX = 0;
		_dragOffsetY = 0;

		constructor() {
			super();
			this.root = this.attachShadow({ mode: "open" });
			this.root.innerHTML = SHADOW_HTML;

			const dialog = this.root.querySelector("dialog");
			const previousButton = this.root.querySelector("[data-previous]");
			const nextButton = this.root.querySelector("[data-next]");
			const center = this.root.querySelector("[data-center]");
			const positionText = this.root.querySelector("[data-position]");
			const select = this.root.querySelector("[data-select]");
			const minimizeButton = this.root.querySelector("[data-minimize]");
			const collapsedButton = this.root.querySelector("[data-collapsed]");
			const dragHandle = this.root.querySelector("[data-drag-handle]");
			const featuresPanel = this.root.querySelector("[data-features-panel]");
			const featuresLabel = this.root.querySelector("[data-features-label]");
			const featuresGrid = this.root.querySelector("[data-features-grid]");
			const featuresCompactButton = this.root.querySelector(
				"[data-features-compact]",
			);

			if (
				!(dialog instanceof HTMLDialogElement) ||
				!(previousButton instanceof HTMLButtonElement) ||
				!(nextButton instanceof HTMLButtonElement) ||
				!(center instanceof HTMLElement) ||
				!(positionText instanceof HTMLElement) ||
				!(select instanceof HTMLSelectElement) ||
				!(minimizeButton instanceof HTMLButtonElement) ||
				!(collapsedButton instanceof HTMLButtonElement) ||
				!(dragHandle instanceof HTMLElement) ||
				!(featuresPanel instanceof HTMLElement) ||
				!(featuresLabel instanceof HTMLElement) ||
				!(featuresGrid instanceof HTMLElement) ||
				!(featuresCompactButton instanceof HTMLButtonElement)
			) {
				throw new Error("Unable to initialize picker");
			}

			this.dialog = dialog;
			this.previousButton = previousButton;
			this.nextButton = nextButton;
			this.center = center;
			this.positionText = positionText;
			this.select = select;
			this.minimizeButton = minimizeButton;
			this.collapsedButton = collapsedButton;
			this.featuresPanel = featuresPanel;
			this.featuresLabel = featuresLabel;
			this.featuresGrid = featuresGrid;
			this.featuresCompactButton = featuresCompactButton;

			this.dialog.addEventListener("keydown", this.onDialogKeyDown);
			this.dialog.addEventListener("pointerdown", this.onDialogPointerDown);

			this.previousButton.addEventListener("click", () => this.moveOption(-1));
			this.nextButton.addEventListener("click", () => this.moveOption(1));

			this.minimizeButton.addEventListener("click", () =>
				this.setMinimized(true),
			);
			this.collapsedButton.addEventListener("click", () =>
				this.setMinimized(false),
			);

			this.featuresCompactButton.addEventListener("click", () =>
				this.setFeaturesMode(false),
			);

			this.select.addEventListener("change", () => {
				const group = this.group;
				if (!group) return;
				const option = group.options[this.select.selectedIndex];
				if (option) this.onSelect?.(option);
			});

			this.center.addEventListener("pointerdown", (event) => {
				if (event.button !== 0) return;
				if (this.select.disabled) return;
				if (event.target instanceof Element && event.target.closest("select"))
					return;
				event.preventDefault();
				event.stopPropagation();
				this.openSelectMenu();
			});

			// Drag — handle only
			dragHandle.addEventListener("pointerdown", this.onDragHandlePointerDown);
		}

		update(group, onSelect) {
			this.group = group;
			this.onSelect = onSelect;
			this.render();
			if (!this.dialog.open) this.dialog.show();
			if (!(this.root.activeElement instanceof HTMLSelectElement)) {
				this.focusDialogForKeyboard();
			}
		}

		focusDialogForKeyboard() {
			const active = this.root.activeElement;
			if (active instanceof HTMLElement && active !== this.dialog)
				active.blur();
			this.dialog.focus({ preventScroll: true });
		}

		setMinimized(minimized) {
			if (minimized) {
				this.setAttribute("data-minimized", "");
			} else {
				this.removeAttribute("data-minimized");
				this.focusDialogForKeyboard();
			}
		}

		setFeaturesMode(enabled) {
			if (enabled) {
				this.setAttribute("data-features", "");
				this.renderFeaturesGrid();
			} else {
				this.removeAttribute("data-features");
				this.focusDialogForKeyboard();
			}
		}

		renderFeaturesGrid() {
			const group = this.group;
			this.featuresLabel.textContent = group ? group.label : "";
			this.featuresGrid.replaceChildren();
			if (!group) return;

			const activeIndex = getActiveIndex(group);

			group.options.forEach((opt, i) => {
				const card = document.createElement("button");
				card.type = "button";
				card.setAttribute("data-feature-card", "");
				if (i === activeIndex) card.setAttribute("data-active", "");

				const num = document.createElement("span");
				num.setAttribute("data-card-num", "");
				num.textContent = String(i + 1).padStart(2, "0");

				const name = document.createElement("span");
				name.setAttribute("data-card-name", "");
				name.textContent = opt.label;

				card.append(num, name);
				card.addEventListener("click", () => {
					this.onSelect?.(opt);
					// Update active state
					this.featuresGrid
						.querySelectorAll("[data-feature-card]")
						.forEach((c, ci) => {
							c.toggleAttribute("data-active", ci === i);
							c.querySelector("[data-card-num]");
						});
				});
				this.featuresGrid.append(card);
			});
		}

		render() {
			if (!this.group) {
				this.positionText.textContent = "0/0";
				this.positionText.title = "No variations available";
				this.select.replaceChildren();
				const placeholder = document.createElement("option");
				placeholder.textContent = "No variations found";
				this.select.append(placeholder);
				this.select.disabled = true;
				this.previousButton.disabled = true;
				this.nextButton.disabled = true;
				if (this.hasAttribute("data-features")) this.renderFeaturesGrid();
				return;
			}

			const group = this.group;
			const activeIndex = getActiveIndex(group);
			const hasMultiple = group.options.length > 1;

			this.positionText.textContent = `${activeIndex + 1}/${group.options.length}`;
			this.positionText.title = group.label;
			this.previousButton.disabled = !hasMultiple;
			this.nextButton.disabled = !hasMultiple;
			this.select.replaceChildren();

			if (group.options.length === 0) {
				const placeholder = document.createElement("option");
				placeholder.textContent = "No variations found";
				this.select.append(placeholder);
				this.select.disabled = true;
				this.positionText.textContent = "0/0";
				if (this.hasAttribute("data-features")) this.renderFeaturesGrid();
				return;
			}

			for (const opt of group.options) {
				const el = document.createElement("option");
				el.textContent = opt.label;
				this.select.append(el);
			}

			this.select.disabled = false;
			this.select.selectedIndex = activeIndex;

			if (this.hasAttribute("data-features")) this.renderFeaturesGrid();
		}

		moveOption(delta) {
			const group = this.group;
			if (!group || group.options.length <= 1) return;

			const nextIndex =
				(getActiveIndex(group) + delta + group.options.length) %
				group.options.length;
			const next = group.options[nextIndex];
			if (next) {
				this.onSelect?.(next);
				this.dialog.focus({ preventScroll: true });
			}
		}

		openSelectMenu() {
			if (this.select.disabled) return;
			this.select.focus({ preventScroll: true });
			if (this.select.showPicker) {
				try {
					this.select.showPicker();
					return;
				} catch {}
			}
			this.select.click();
		}

		// ── Drag ────────────────────────────────────────────────────────────────

		onDragHandlePointerDown = (event) => {
			if (event.button !== 0) return;

			event.preventDefault();
			const rect = this.getBoundingClientRect();
			this._dragOffsetX = event.clientX - rect.left;
			this._dragOffsetY = event.clientY - rect.top;
			this._dragging = true;

			// Convert to top/left absolute positioning so drag works in any direction
			this.style.left = `${rect.left}px`;
			this.style.top = `${rect.top}px`;
			this.style.bottom = "auto";
			this.style.transform = "none";

			this.setAttribute("data-dragging", "");
			this.setPointerCapture(event.pointerId);
		};

		onPointerMove = (event) => {
			if (!this._dragging) return;
			const rect = this.getBoundingClientRect();
			const x = Math.max(
				0,
				Math.min(
					event.clientX - this._dragOffsetX,
					window.innerWidth - rect.width,
				),
			);
			const y = Math.max(
				0,
				Math.min(
					event.clientY - this._dragOffsetY,
					window.innerHeight - rect.height,
				),
			);
			this.style.left = `${x}px`;
			this.style.top = `${y}px`;
		};

		onPointerUp = () => {
			this._dragging = false;
			this.removeAttribute("data-dragging");
		};

		connectedCallback() {
			if (!this.dialog.open) this.dialog.show();
			this.focusDialogForKeyboard();
			this.addEventListener("pointermove", this.onPointerMove);
			this.addEventListener("pointerup", this.onPointerUp);
			this.addEventListener("pointercancel", this.onPointerUp);
		}

		disconnectedCallback() {
			this.removeEventListener("pointermove", this.onPointerMove);
			this.removeEventListener("pointerup", this.onPointerUp);
			this.removeEventListener("pointercancel", this.onPointerUp);
		}

		// ── Keyboard & pointer on dialog ────────────────────────────────────────

		onDialogPointerDown = (event) => {
			if (event.button !== 0) return;
			if (!(event.target instanceof Element)) return;
			if (event.target.closest("[data-center]")) return;
			if (event.target.closest("button, select")) return;
			this.dialog.focus({ preventScroll: true });
		};

		onDialogKeyDown = (event) => {
			if (!this.group) return;
			if (event.metaKey || event.ctrlKey || event.altKey) return;

			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				if (this.root.activeElement instanceof HTMLSelectElement) return;
				event.preventDefault();
				this.openSelectMenu();
				return;
			}

			if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
				event.preventDefault();
				this.moveOption(event.key === "ArrowRight" ? 1 : -1);
			}
		};
	}

	if (!customElements.get(ELEMENT_NAME)) {
		customElements.define(ELEMENT_NAME, UioptionPicker);
	}

	// --- DOM observer + picker lifecycle ---

	function init() {
		let pickerEl = null;
		let rafPending = false;

		function scheduleUpdate() {
			if (rafPending) return;
			rafPending = true;
			requestAnimationFrame(() => {
				rafPending = false;
				update();
			});
		}

		function update() {
			const group = scanPickerGroup();

			if (!group) {
				pickerEl?.remove();
				pickerEl = null;
				return;
			}

			showFirstVisible(group);

			if (!pickerEl) {
				pickerEl = document.createElement(ELEMENT_NAME);
				(document.body ?? document.documentElement).append(pickerEl);
			}

			pickerEl.update(group, (selected) => {
				if (selectOption(group, selected)) update();
			});
		}

		new MutationObserver((records) => {
			for (const record of records) {
				if (record.type === "attributes") {
					if (isPickerRelated(record.target)) {
						scheduleUpdate();
						return;
					}
					continue;
				}

				for (const node of record.addedNodes) {
					if (isPickerRelated(node)) {
						scheduleUpdate();
						return;
					}
				}

				for (const node of record.removedNodes) {
					if (isPickerRelated(node)) {
						scheduleUpdate();
						return;
					}
				}
			}
		}).observe(document.documentElement, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ["data-uioption-pick", "data-uioption-option", "hidden"],
		});

		update();
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
})();
