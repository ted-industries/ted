export interface Theme {
    name: string;
    type: "dark" | "light";
    colors: {
        background: string;
        foreground: string;
        sidebarBg: string;
        sidebarFg: string;
        border: string;
        accent: string;
        inputBg: string;
        inputFg: string;
        inputBorder: string;
        activeTabBg: string;
        activeTabFg: string;
        inactiveTabBg: string;
        inactiveTabFg: string;
        statusBarBg: string;
        statusBarFg: string;
        titleBarBg: string;
        titleBarFg: string;
        selection: string;
        lineHighlight: string;
        agentBg: string;
        agentFg: string;
        agentUserBg: string;
        agentUserFg: string;
        agentTrace: string; // dim trace color
        scrollThumb: string;
        scrollThumbHover: string;
        scrollTrack: string;
        // Syntax Highlighting
        syntax: {
            comment: string;
            keyword: string;
            string: string;
            number: string;
            type: string;
            variable: string;
            function: string;
            operator: string;
            bracket: string;
            class: string;
            tag: string;
            attribute: string;
        };
    };
}

const tedDark: Theme = {
    name: "ted",
    type: "dark",
    colors: {
        background: "#1a1a1a",
        foreground: "#d4d4d4",
        sidebarBg: "#181818",
        sidebarFg: "#cccccc",
        border: "#252525",
        accent: "#ffffff10",
        inputBg: "#1e1e1e",
        inputFg: "#cccccc",
        inputBorder: "#333333",
        activeTabBg: "#1a1a1a",
        activeTabFg: "#ffffff",
        inactiveTabBg: "#181818",
        inactiveTabFg: "#888888",
        statusBarBg: "#181818",
        statusBarFg: "#cccccc",
        titleBarBg: "#1a1a1a",
        titleBarFg: "#cccccc",
        selection: "#ffffff15",
        lineHighlight: "#ffffff08",
        agentBg: "#181818",
        agentFg: "#999999",
        agentUserBg: "#ffffff08",
        agentUserFg: "#cccccc",
        agentTrace: "#444444",
        scrollThumb: "#2a2a2a",
        scrollThumbHover: "#3a3a3a",
        scrollTrack: "transparent",
        syntax: {
            comment: "#606060",
            keyword: "#c678dd",
            string: "#98c379",
            number: "#d19a66",
            type: "#e5c07b",
            variable: "#e06c75",
            function: "#61afef",
            operator: "#56b6c2",
            bracket: "#abb2bf",
            class: "#e5c07b",
            tag: "#e06c75",
            attribute: "#d19a66",
        },
    },
};

const tedLight: Theme = {
    name: "ted light",
    type: "light",
    colors: {
        background: "#ffffff",
        foreground: "#333333",
        sidebarBg: "#f3f3f3",
        sidebarFg: "#666666",
        border: "#e5e5e5",
        accent: "#00000010",
        inputBg: "#ffffff",
        inputFg: "#333333",
        inputBorder: "#e5e5e5",
        activeTabBg: "#ffffff",
        activeTabFg: "#000000",
        inactiveTabBg: "#ececec",
        inactiveTabFg: "#888888",
        statusBarBg: "#f3f3f3",
        statusBarFg: "#666666",
        titleBarBg: "#ffffff",
        titleBarFg: "#333333",
        selection: "#00000010",
        lineHighlight: "#00000005",
        agentBg: "#f8f8f8",
        agentFg: "#555555",
        agentUserBg: "#00000008",
        agentUserFg: "#333333",
        agentTrace: "#999999",
        scrollThumb: "#cccccc",
        scrollThumbHover: "#bbbbbb",
        scrollTrack: "transparent",
        syntax: {
            comment: "#a0a1a7",
            keyword: "#a626a4",
            string: "#50a14f",
            number: "#986801",
            type: "#c18401",
            variable: "#e45649",
            function: "#4078f2",
            operator: "#0184bc",
            bracket: "#383a42",
            class: "#c18401",
            tag: "#e45649",
            attribute: "#986801",
        },
    },
};

const solarizedDark: Theme = {
    name: "ted solarized",
    type: "dark",
    colors: {
        background: "#002b36",
        foreground: "#839496",
        sidebarBg: "#073642",
        sidebarFg: "#93a1a1",
        border: "#073642",
        accent: "#073642",
        inputBg: "#002b36",
        inputFg: "#93a1a1",
        inputBorder: "#586e75",
        activeTabBg: "#002b36",
        activeTabFg: "#93a1a1",
        inactiveTabBg: "#073642",
        inactiveTabFg: "#586e75",
        statusBarBg: "#073642",
        statusBarFg: "#93a1a1",
        titleBarBg: "#002b36",
        titleBarFg: "#93a1a1",
        selection: "#073642",
        lineHighlight: "#073642",
        agentBg: "#073642",
        agentFg: "#839496",
        agentUserBg: "#002b36",
        agentUserFg: "#93a1a1",
        agentTrace: "#586e75",
        scrollThumb: "#586e75",
        scrollThumbHover: "#657b83",
        scrollTrack: "transparent",
        syntax: {
            comment: "#586e75",
            keyword: "#859900",
            string: "#2aa198",
            number: "#d33682",
            type: "#b58900",
            variable: "#268bd2",
            function: "#268bd2",
            operator: "#859900",
            bracket: "#839496",
            class: "#b58900",
            tag: "#268bd2",
            attribute: "#b58900",
        },
    },
};

const solarizedLight: Theme = {
    name: "ted solarized light",
    type: "light",
    colors: {
        background: "#fdf6e3",
        foreground: "#657b83",
        sidebarBg: "#eee8d5",
        sidebarFg: "#586e75",
        border: "#ddd6c1",
        accent: "#eee8d5",
        inputBg: "#fdf6e3",
        inputFg: "#657b83",
        inputBorder: "#93a1a1",
        activeTabBg: "#fdf6e3",
        activeTabFg: "#586e75",
        inactiveTabBg: "#eee8d5",
        inactiveTabFg: "#93a1a1",
        statusBarBg: "#eee8d5",
        statusBarFg: "#586e75",
        titleBarBg: "#fdf6e3",
        titleBarFg: "#586e75",
        selection: "#eee8d5",
        lineHighlight: "#eee8d5",
        agentBg: "#eee8d5",
        agentFg: "#657b83",
        agentUserBg: "#fdf6e3",
        agentUserFg: "#586e75",
        agentTrace: "#93a1a1",
        scrollThumb: "#93a1a1",
        scrollThumbHover: "#839496",
        scrollTrack: "transparent",
        syntax: {
            comment: "#93a1a1",
            keyword: "#859900",
            string: "#2aa198",
            number: "#d33682",
            type: "#b58900",
            variable: "#268bd2",
            function: "#268bd2",
            operator: "#859900",
            bracket: "#657b83",
            class: "#b58900",
            tag: "#268bd2",
            attribute: "#b58900",
        },
    },
};

export const themes: Record<string, Theme> = {
    ted: tedDark,
    "ted light": tedLight,
    "ted solarized": solarizedDark,
    "ted solarized light": solarizedLight,
};

export function applyTheme(themeName: string) {
    const theme = themes[themeName] || themes.ted;
    const root = document.documentElement;

    // Apply colors to CSS variables
    root.style.setProperty("--background", theme.colors.background);
    root.style.setProperty("--foreground", theme.colors.foreground);
    root.style.setProperty("--sidebar-bg", theme.colors.sidebarBg);
    root.style.setProperty("--sidebar-fg", theme.colors.sidebarFg);
    root.style.setProperty("--border", theme.colors.border);
    root.style.setProperty("--accent", theme.colors.accent);
    root.style.setProperty("--input-bg", theme.colors.inputBg);
    root.style.setProperty("--input-fg", theme.colors.inputFg);
    root.style.setProperty("--input-border", theme.colors.inputBorder);
    root.style.setProperty("--active-tab-bg", theme.colors.activeTabBg);
    root.style.setProperty("--active-tab-fg", theme.colors.activeTabFg);
    root.style.setProperty("--inactive-tab-bg", theme.colors.inactiveTabBg);
    root.style.setProperty("--inactive-tab-fg", theme.colors.inactiveTabFg);
    root.style.setProperty("--status-bar-bg", theme.colors.statusBarBg);
    root.style.setProperty("--status-bar-fg", theme.colors.statusBarFg);
    root.style.setProperty("--title-bar-bg", theme.colors.titleBarBg);
    root.style.setProperty("--title-bar-fg", theme.colors.titleBarFg);
    root.style.setProperty("--selection", theme.colors.selection);
    root.style.setProperty("--line-highlight", theme.colors.lineHighlight);
    root.style.setProperty("--agent-bg", theme.colors.agentBg);
    root.style.setProperty("--agent-fg", theme.colors.agentFg);
    root.style.setProperty("--agent-user-bg", theme.colors.agentUserBg);
    root.style.setProperty("--agent-user-fg", theme.colors.agentUserFg);
    root.style.setProperty("--agent-trace", theme.colors.agentTrace);
    root.style.setProperty("--scroll-thumb", theme.colors.scrollThumb);
    root.style.setProperty("--scroll-thumb-hover", theme.colors.scrollThumbHover);
    root.style.setProperty("--scroll-track", theme.colors.scrollTrack);

    // Syntax Highlighting
    root.style.setProperty("--syntax-comment", theme.colors.syntax.comment);
    root.style.setProperty("--syntax-keyword", theme.colors.syntax.keyword);
    root.style.setProperty("--syntax-string", theme.colors.syntax.string);
    root.style.setProperty("--syntax-number", theme.colors.syntax.number);
    root.style.setProperty("--syntax-type", theme.colors.syntax.type);
    root.style.setProperty("--syntax-variable", theme.colors.syntax.variable);
    root.style.setProperty("--syntax-function", theme.colors.syntax.function);
    root.style.setProperty("--syntax-operator", theme.colors.syntax.operator);
    root.style.setProperty("--syntax-bracket", theme.colors.syntax.bracket);
    root.style.setProperty("--syntax-class", theme.colors.syntax.class);
    root.style.setProperty("--syntax-tag", theme.colors.syntax.tag);
    root.style.setProperty("--syntax-attribute", theme.colors.syntax.attribute);

    // Set a data-theme attribute on body for specific styling needs
    document.body.setAttribute("data-theme", theme.type);
}
