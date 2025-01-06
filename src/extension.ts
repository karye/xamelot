import * as vscode from 'vscode';
import { parseXSD } from './xsdparser'; // Funktion för att parsa xsd-filen
import { generateGrammarFromXSD } from './xsdparser';

let xamlSchema: any;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating extension Xamelot...');

    // Add text in status bar
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusBarItem.text = 'Xamelot';
    statusBarItem.tooltip = 'XAML Extension for Visual Studio Code';
    statusBarItem.show();

    // Register the command
    context.subscriptions.push(
        vscode.commands.registerCommand('xamelot.helloWorld', () => {
            vscode.window.showInformationMessage('Hello, Xamelot!');
        })
    );

    // Läs och parse xsd-filen
    const xsdPath = vscode.Uri.file(context.extensionPath + '/syntax/xaml.xsd').fsPath;
    console.log('XSD Path:', xsdPath);
    try {
        xamlSchema = await parseXSD(xsdPath);
        console.log('XAML Schema:', xamlSchema);
    } catch (error) {
        console.error('Error parsing XSD:', error);
    }

    // Generera tmLanguage-fil
    const grammarPath = context.extensionPath + '/syntax/xaml.tmLanguage.json';
    try {
        await createGrammarFile(xamlSchema, grammarPath);
    } catch (error) {
        console.error('Error creating grammar file:', error);
    }

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            { language: 'xaml' },
            new XamlCompletionProvider(xamlSchema),
            '<', ' ', '"'
        )
    );

    vscode.workspace.onDidChangeTextDocument(event => {
        const changes = event.contentChanges;
        for (const change of changes) {
            if (change.text === '>') {
                const line = event.document.lineAt(change.range.start.line).text;
                const tagNameMatch = line.match(/<(\w+)/);
                if (tagNameMatch) {
                    const tagName = tagNameMatch[1];
                    const closingTag = `</${tagName}>`;
                    const edit = new vscode.WorkspaceEdit();
                    edit.insert(event.document.uri, change.range.end, closingTag);
                    vscode.workspace.applyEdit(edit);
                    console.log('Inserted closing tag:', closingTag);
                }
            }
        }
    });

    console.log('XAML extension is now active!');
}

class XamlCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private schema: any) { }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
        const line = document.lineAt(position).text.substring(0, position.character);
        console.log('Providing completion items for line:', line);

        if (line.endsWith('<')) {
            return this.getElements();
        } else if (line.match(/<\w+\s+\w*$/)) {
            return this.getAttributes(line);
        } else if (line.match(/<\w+\s+\w+=".*$/)) {
            return this.getClosingTag(line);
        }

        return undefined;
    }

    private getElements() {
        console.log('Getting elements...');
        const items = Object.keys(this.schema.elements).map(key => {
            return new vscode.CompletionItem(key, vscode.CompletionItemKind.Class);
        });
        return items;
    }

    private getAttributes(line: string) {
        console.log('Getting attributes for line:', line);
        const elementName = line.match(/<(\w+)/)?.[1];
        const attributes = elementName ? this.schema.elements[elementName]?.attributes || [] : [];
        return attributes.map((attr: string) => new vscode.CompletionItem(attr, vscode.CompletionItemKind.Property));
    }

    private getClosingTag(line: string) {
        console.log('Getting closing tag for line:', line);
        const elementName = line.match(/<(\w+)/)?.[1];
        if (elementName) {
            return [
                new vscode.CompletionItem(`</${elementName}>`, vscode.CompletionItemKind.Snippet)
            ];
        }
        return [];
    }
}

async function createGrammarFile(schema: any, outputPath: string) {
    console.log('Creating grammar file...');
    const grammar = generateGrammarFromXSD(schema);
    const fs = require('fs');
    fs.writeFileSync(outputPath, JSON.stringify(grammar, null, 2));
    console.log('Grammar file created at:', outputPath);
}

export function deactivate() {
    console.log('Deactivating extension...');
}