const themeBtn = document.getElementById("theme-btn");

// Joined with spaces into a single-line prompt — edit line by line.
const PROMPT_PICKER = [
	"Generate UI variants using the uioption picker:",
	'wrap each decision in `<div data-uioption-pick="Label" class="contents">`,',
	'each option in `<div data-uioption-option="Name" class="contents">`.',
	"One option visible, rest hidden.",
	"3–4 options per decision.",
	"Never add picker script tags — the Chrome extension injects automatically.",
].join(" ");

let currentTab = null;

// ── Helpers ──────────────────────────────────────────────────────────────────

function showMessageNear(btn, text, type = "") {
	const container = btn.closest(".p-section, .tool-card");
	if (!container) return;
	const msg = container.querySelector(".p-message, .p-message-inline");
	if (!msg) return;
	msg.textContent = text;
	msg.className = msg.className.replace(/\s*(success|error)\b/g, "").trim();
	if (type) {
		msg.classList.add(type);
		setTimeout(() => {
			msg.textContent = "";
			msg.classList.remove(type);
		}, 2500);
	}
}

// Update all variants' inject/uninject button visibility in lockstep.
function setInjectedState(injected) {
	document
		.querySelectorAll('[id^="inject-btn"]:not([id^="inject-inspector"])')
		.forEach((btn) => {
			btn.style.display = injected ? "none" : "";
		});
	document
		.querySelectorAll('[id^="uninject-btn"]:not([id^="uninject-inspector"])')
		.forEach((btn) => {
			btn.style.display = injected ? "" : "none";
		});
}

function setInspectorState(injected) {
	document.querySelectorAll('[id^="inject-inspector-btn"]').forEach((btn) => {
		btn.style.display = injected ? "none" : "";
	});
	document.querySelectorAll('[id^="uninject-inspector-btn"]').forEach((btn) => {
		btn.style.display = injected ? "" : "none";
	});
}

function applyTheme(theme) {
	document.body.classList.toggle("dark", theme === "dark");
}

function applyStyleToggle(style) {
	document.querySelectorAll("[data-style]").forEach((btn) => {
		btn.classList.toggle("active", btn.getAttribute("data-style") === style);
	});
}

// Keep all auto-inject checkboxes in sync across picker variants.
function setAutoInject(checked) {
	document.querySelectorAll('[id^="auto-inject"]').forEach((el) => {
		el.checked = checked;
	});
}

// ── Settings & state ─────────────────────────────────────────────────────────

async function loadSettings() {
	const { autoInject, theme, pickerStyle } = await chrome.storage.sync.get({
		autoInject: true,
		theme: "light",
		pickerStyle: "compact",
	});
	setAutoInject(autoInject);
	applyTheme(theme);
	applyStyleToggle(pickerStyle);
}

async function syncState() {
	if (!currentTab?.id) return;
	const [{ injected }, { injected: inspectorInjected }] = await Promise.all([
		chrome.runtime.sendMessage({
			type: "isInjected",
			tabId: currentTab.id,
		}),
		chrome.runtime.sendMessage({
			type: "isInspectorInjected",
			tabId: currentTab.id,
		}),
	]);
	setInjectedState(injected);
	setInspectorState(inspectorInjected);
}

// ── Event delegation ─────────────────────────────────────────────────────────

themeBtn.addEventListener("click", () => {
	const isDark = document.body.classList.toggle("dark");
	chrome.storage.sync.set({ theme: isDark ? "dark" : "light" });
});

document.addEventListener("change", (e) => {
	if (
		e.target instanceof HTMLInputElement &&
		e.target.id?.startsWith("auto-inject")
	) {
		const checked = e.target.checked;
		setAutoInject(checked);
		chrome.storage.sync.set({ autoInject: checked });
	}
});

document.addEventListener("click", async (e) => {
	// Style toggle
	const seg = e.target.closest("[data-style]");
	if (seg) {
		const style = seg.getAttribute("data-style");
		chrome.storage.sync.set({ pickerStyle: style });
		applyStyleToggle(style);
		if (currentTab?.id) {
			chrome.runtime.sendMessage({
				type: "setPickerStyle",
				tabId: currentTab.id,
				style,
			});
		}
		return;
	}

	const btn = e.target.closest("button");
	if (!btn) return;

	const id = btn.id ?? "";

	// Copy prompt — no tab needed
	if (id.startsWith("copy-btn")) {
		await navigator.clipboard.writeText(PROMPT_PICKER);
		btn.classList.add("copied");
		btn.textContent = "Copied";
		setTimeout(() => {
			btn.classList.remove("copied");
			btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z"/><path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z"/></svg> Copy`;
		}, 2000);
		return;
	}

	if (!currentTab?.id) return;

	if (id.startsWith("inject-inspector-btn")) {
		btn.disabled = true;
		const result = await chrome.runtime.sendMessage({
			type: "injectInspector",
			tabId: currentTab.id,
		});
		if (result.success) {
			setInspectorState(true);
			showMessageNear(btn, "Injected", "success");
		} else {
			showMessageNear(btn, result.error ?? "Failed", "error");
		}
		btn.disabled = false;
		return;
	}

	if (id.startsWith("uninject-inspector-btn")) {
		btn.disabled = true;
		const result = await chrome.runtime.sendMessage({
			type: "uninjectInspector",
			tabId: currentTab.id,
		});
		if (result.success) {
			setInspectorState(false);
			showMessageNear(btn, "Removed", "success");
		} else {
			showMessageNear(btn, result.error ?? "Failed", "error");
		}
		btn.disabled = false;
		return;
	}

	if (id.startsWith("inject-btn")) {
		btn.disabled = true;
		const result = await chrome.runtime.sendMessage({
			type: "inject",
			tabId: currentTab.id,
		});
		if (result.success) {
			setInjectedState(true);
			showMessageNear(btn, "Injected", "success");
		} else {
			showMessageNear(btn, result.error ?? "Failed", "error");
		}
		btn.disabled = false;
		return;
	}

	if (id.startsWith("uninject-btn")) {
		btn.disabled = true;
		const result = await chrome.runtime.sendMessage({
			type: "uninject",
			tabId: currentTab.id,
		});
		if (result.success) {
			setInjectedState(false);
			showMessageNear(btn, "Removed", "success");
		} else {
			showMessageNear(btn, result.error ?? "Failed", "error");
		}
		btn.disabled = false;
		return;
	}
});

// ── Init ─────────────────────────────────────────────────────────────────────

async function init() {
	[currentTab] = await chrome.tabs.query({
		active: true,
		currentWindow: true,
	});
	await Promise.all([loadSettings(), syncState()]);
}

init();
