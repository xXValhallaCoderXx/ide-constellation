import * as vscode from 'vscode';

export class MapViewProvider implements vscode.TreeDataProvider<MapItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<MapItem | undefined | null | void> = new vscode.EventEmitter<MapItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<MapItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() { }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: MapItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: MapItem): Thenable<MapItem[]> {
        if (!element) {
            // Root level items
            return Promise.resolve([
                new MapItem('Show Architecture Map', 'Click to open the architecture visualization', vscode.TreeItemCollapsibleState.None, {
                    command: 'kiro-constellation.showMap',
                    title: 'Show Map'
                }),
                new MapItem('Components', 'Architecture components', vscode.TreeItemCollapsibleState.Collapsed),
                new MapItem('Connections', 'Component connections', vscode.TreeItemCollapsibleState.Collapsed)
            ]);
        } else {
            // Child items
            if (element.label === 'Components') {
                return Promise.resolve([
                    new MapItem('Frontend', 'Frontend components', vscode.TreeItemCollapsibleState.None),
                    new MapItem('Backend', 'Backend services', vscode.TreeItemCollapsibleState.None),
                    new MapItem('Database', 'Data layer', vscode.TreeItemCollapsibleState.None)
                ]);
            } else if (element.label === 'Connections') {
                return Promise.resolve([
                    new MapItem('API Calls', 'REST/GraphQL connections', vscode.TreeItemCollapsibleState.None),
                    new MapItem('Data Flow', 'Data movement patterns', vscode.TreeItemCollapsibleState.None)
                ]);
            }
        }
        return Promise.resolve([]);
    }
}

export class MapItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly tooltip: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.tooltip = tooltip;
        this.description = '';

        // Add icons based on the item type
        if (label === 'Show Architecture Map') {
            this.iconPath = new vscode.ThemeIcon('graph');
        } else if (label === 'Components') {
            this.iconPath = new vscode.ThemeIcon('folder');
        } else if (label === 'Connections') {
            this.iconPath = new vscode.ThemeIcon('link');
        } else if (label === 'Frontend') {
            this.iconPath = new vscode.ThemeIcon('browser');
        } else if (label === 'Backend') {
            this.iconPath = new vscode.ThemeIcon('server');
        } else if (label === 'Database') {
            this.iconPath = new vscode.ThemeIcon('database');
        } else {
            this.iconPath = new vscode.ThemeIcon('circle-outline');
        }
    }
}
