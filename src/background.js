const DEFAULT_PATTERNS = [
	"http://localhost/*",
	"http://127.0.0.1/*",
	"file:///*",
];

async function getSettings() {
	return chrome.storage.sync.get({
		autoInject: true,
		patterns: DEFAULT_PATTERNS,
	});
}

async function applyPickerStyle(tabId, style) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: (s) => {
				const picker = document.querySelector("uioption-picker");
				if (!picker) return;
				if (s === "features") {
					picker.setAttribute("data-features", "");
					picker.setFeaturesMode?.(true);
				} else {
					picker.removeAttribute("data-features");
					picker.setFeaturesMode?.(false);
				}
			},
			args: [style],
		});
	} catch {}
}

async function injectPicker(tabId) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ["content/ui-picker.js"],
			world: "MAIN",
		});
		const { pickerStyle } = await chrome.storage.sync.get({
			pickerStyle: "compact",
		});
		if (pickerStyle === "features") await applyPickerStyle(tabId, "features");
		return { success: true };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

async function uninjectPicker(tabId) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: () => {
				document.querySelector("uioption-picker")?.remove();
				window.__uioptionPickerLoaded = false;
			},
		});
		return { success: true };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

async function isInjected(tabId) {
	try {
		const [{ result }] = await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: () => !!window.__uioptionPickerLoaded,
		});
		return result;
	} catch {
		return false;
	}
}

async function injectInspector(tabId) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			files: ["content/ui-inspector.js"],
			world: "MAIN",
		});
		return { success: true };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

async function uninjectInspector(tabId) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: () => {
				window.__uioptionInspectorCleanup?.();
				document.querySelector("uioption-inspector")?.remove();
				window.__uioptionInspectorLoaded = false;
			},
		});
		return { success: true };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

async function isInspectorInjected(tabId) {
	try {
		const [{ result }] = await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: () => !!window.__uioptionInspectorLoaded,
		});
		return result;
	} catch {
		return false;
	}
}

async function getPickerGroups(tabId) {
	try {
		const [{ result }] = await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: () => {
				const pickers = document.querySelectorAll("[data-uioption-pick]");
				return Array.from(pickers).map((picker, gi) => {
					const options = Array.from(
						picker.querySelectorAll("[data-uioption-option]"),
					)
						.filter((opt) => opt.closest("[data-uioption-pick]") === picker)
						.map((opt, i) => ({
							label:
								opt.getAttribute("data-uioption-option") || `Option ${i + 1}`,
							active: !opt.hidden && opt.style.display !== "none",
						}));
					return {
						index: gi,
						label:
							picker.getAttribute("data-uioption-pick") || `Decision ${gi + 1}`,
						options,
					};
				});
			},
		});
		return { success: true, groups: result ?? [] };
	} catch (e) {
		return { success: false, error: e.message, groups: [] };
	}
}

async function selectPickerOption(tabId, groupIndex, optionIndex) {
	try {
		await chrome.scripting.executeScript({
			target: { tabId },
			world: "MAIN",
			func: (gIdx, oIdx) => {
				const pickers = document.querySelectorAll("[data-uioption-pick]");
				const picker = pickers[gIdx];
				if (!picker) return;
				const options = Array.from(
					picker.querySelectorAll("[data-uioption-option]"),
				).filter((opt) => opt.closest("[data-uioption-pick]") === picker);
				options.forEach((opt, i) => {
					const hide = i !== oIdx;
					opt.hidden = hide;
					opt.style.display = hide ? "none" : "";
				});
			},
			args: [groupIndex, optionIndex],
		});
		return { success: true };
	} catch (e) {
		return { success: false, error: e.message };
	}
}

function matchesPatterns(url, patterns) {
	let parsed;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}

	return patterns.some((pattern) => {
		// file:// patterns have no hostname — handle separately
		if (pattern.startsWith("file://")) {
			if (parsed.protocol !== "file:") return false;
			const pathPattern = pattern.slice("file://".length);
			if (pathPattern === "/*" || pathPattern === "*") return true;
			return parsed.pathname.startsWith(pathPattern.replace(/\*$/, ""));
		}

		// Chrome match patterns: <scheme>://<host>/<path>
		// The host segment matches hostname only — port is not part of it.
		const m = pattern.match(/^(\*|https?):\/\/([^/]+)\/(.*)$/);
		if (!m) return false;
		const [, scheme, host, path] = m;

		const schemeOk = scheme === "*" || parsed.protocol === `${scheme}:`;
		const hostOk = host === "*" || parsed.hostname === host;
		const pathOk =
			path === "*" || parsed.pathname.startsWith(`/${path.replace(/\*$/, "")}`);

		return schemeOk && hostOk && pathOk;
	});
}

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
	if (changeInfo.status !== "complete" || !tab.url) return;

	const settings = await getSettings();
	if (!settings.autoInject) return;

	if (matchesPatterns(tab.url, settings.patterns)) {
		await injectPicker(tabId);
	}
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
	if (message.type === "inject") {
		injectPicker(message.tabId).then(sendResponse);
		return true;
	}
	if (message.type === "uninject") {
		uninjectPicker(message.tabId).then(sendResponse);
		return true;
	}
	if (message.type === "isInjected") {
		isInjected(message.tabId).then((injected) => sendResponse({ injected }));
		return true;
	}
	if (message.type === "injectInspector") {
		injectInspector(message.tabId).then(sendResponse);
		return true;
	}
	if (message.type === "uninjectInspector") {
		uninjectInspector(message.tabId).then(sendResponse);
		return true;
	}
	if (message.type === "isInspectorInjected") {
		isInspectorInjected(message.tabId).then((injected) =>
			sendResponse({ injected }),
		);
		return true;
	}
	if (message.type === "getPickerGroups") {
		getPickerGroups(message.tabId).then(sendResponse);
		return true;
	}
	if (message.type === "selectPickerOption") {
		selectPickerOption(
			message.tabId,
			message.groupIndex,
			message.optionIndex,
		).then(sendResponse);
		return true;
	}
	if (message.type === "setPickerStyle") {
		applyPickerStyle(message.tabId, message.style).then(() =>
			sendResponse({ success: true }),
		);
		return true;
	}
});
