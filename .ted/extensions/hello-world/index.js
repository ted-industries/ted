export function activate(api) {
    console.log("[hello-world] Extension activated!");

    // Register a command in the command palette
    api.commands.register("greet", "Hello World: Greet", () => {
        api.editor.showNotification("Hello from the hello-world extension! 🎉", "info");
    });

    // Add a statusbar item
    api.statusbar.addItem("status", "👋 Hello", {
        align: "right",
        priority: 100,
        onClick: () => {
            api.editor.showNotification("You clicked the Hello statusbar item!", "info");
        },
    });
}

export function deactivate() {
    console.log("[hello-world] Extension deactivated!");
}
