import * as fs from 'fs';
import * as xml2js from 'xml2js';

interface SchemaElement {
    attributes: { [key: string]: string };
    childElements: string[];
}

interface Schema {
    elements: { [key: string]: SchemaElement };
    complexTypes: { [key: string]: SchemaElement };
}

export async function parseXSD(filePath: string): Promise<Schema> {
    const xsdContent = fs.readFileSync(filePath, 'utf-8');
    const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
    const result = await parser.parseStringPromise(xsdContent);

    const schema: Schema = { elements: {}, complexTypes: {} };

    // First pass: Collect all elements and complex types
    console.log('First pass: Collecting elements and complex types...');
    const collectElementsAndComplexTypes = (element: any, type: 'element' | 'complexType') => {
        const name = element.name || element.$?.name;
        if (name) {
            if (type === 'element') {
                schema.elements[name] = { attributes: {}, childElements: [] };
                console.log(`Collected element: ${name}`);
            } else if (type === 'complexType') {
                schema.complexTypes[name] = { attributes: {}, childElements: [] };
                console.log(`Collected complexType: ${name}`);
            }
        }
    };

    const elements = result["xs:schema"]["xs:element"];
    if (Array.isArray(elements)) {
        for (const el of elements) {
            collectElementsAndComplexTypes(el, 'element');
        }
    } else if (elements) {
        collectElementsAndComplexTypes(elements, 'element');
    }

    const complexTypes = result["xs:schema"]["xs:complexType"];
    if (Array.isArray(complexTypes)) {
        for (const ct of complexTypes) {
            collectElementsAndComplexTypes(ct, 'complexType');
        }
    } else if (complexTypes) {
        collectElementsAndComplexTypes(complexTypes, 'complexType');
    }

    // Second pass: Process complex types first
    console.log('Second pass: Processing complex types...');
    const processComplexType = (complexType: any) => {
        const name = complexType.name || complexType.$?.name;
        if (!name) {
            return;
        }

        const attributes: { [key: string]: string } = {};
        const childElements: string[] = [];

        // Lägg till attribut från complexType
        if (complexType["xs:attribute"]) {
            const attrArray = Array.isArray(complexType["xs:attribute"]) ? complexType["xs:attribute"] : [complexType["xs:attribute"]];
            for (const attr of attrArray) {
                const attrName = attr.name || attr.$?.name;
                const documentation = attr["xs:annotation"]?.["xs:documentation"] || "";
                attributes[attrName] = documentation;
                console.log(`Added attribute: ${attrName} to complexType: ${name}`);
            }
        }

        // Lägg till attribut från xs:complexType > xs:complexContent > xs:extension > xs:attribute
        if (complexType["xs:complexContent"]?.["xs:extension"]?.["xs:attribute"]) {
            const attrArray = Array.isArray(complexType["xs:complexContent"]["xs:extension"]["xs:attribute"])
                ? complexType["xs:complexContent"]["xs:extension"]["xs:attribute"]
                : [complexType["xs:complexContent"]["xs:extension"]["xs:attribute"]];
            for (const attr of attrArray) {
                const attrName = attr.name || attr.$?.name;
                const documentation = attr["xs:annotation"]?.["xs:documentation"] || "";
                attributes[attrName] = documentation;
                console.log(`Added attribute: ${attrName} from xs:extension to complexType: ${name}`);
            }
        }

        schema.complexTypes[name] = {
            attributes,
            childElements
        };

        console.log(`Processed complexType: ${name}, attributes: ${JSON.stringify(attributes)}, childElements: ${JSON.stringify(childElements)}`);
    };

    if (Array.isArray(complexTypes)) {
        for (const ct of complexTypes) {
            processComplexType(ct);
        }
    } else if (complexTypes) {
        processComplexType(complexTypes);
    }

    // Third pass: Process elements
    console.log('Third pass: Processing elements...');
    const processElement = (element: any) => {
        const name = element.name || element.$?.name;
        if (!name) {
            return;
        }

        const attributes: { [key: string]: string } = {};
        const childElements = [];

        // Lägg till attribut från elementet
        if (element["xs:attribute"]) {
            const attrArray = Array.isArray(element["xs:attribute"]) ? element["xs:attribute"] : [element["xs:attribute"]];
            for (const attr of attrArray) {
                const attrName = attr.name || attr.$?.name;
                const documentation = attr["xs:annotation"]?.["xs:documentation"] || "";
                attributes[attrName] = documentation;
                console.log(`Added attribute: ${attrName} to element: ${name}`);
            }
        }

        // Lägg till attribut från xs:complexType
        if (element["xs:complexType"]?.["xs:attribute"]) {
            const attrArray = Array.isArray(element["xs:complexType"]["xs:attribute"]) ? element["xs:complexType"]["xs:attribute"] : [element["xs:complexType"]["xs:attribute"]];
            for (const attr of attrArray) {
                const attrName = attr.name || attr.$?.name;
                const documentation = attr["xs:annotation"]?.["xs:documentation"] || "";
                attributes[attrName] = documentation;
                console.log(`Added attribute: ${attrName} from xs:complexType to element: ${name}`);
            }
        }

        // Lägg till attribut från xs:complexType > xs:complexContent > xs:extension > xs:attribute
        if (element["xs:complexType"]?.["xs:complexContent"]?.["xs:extension"]?.["xs:attribute"]) {
            const attrArray = Array.isArray(element["xs:complexType"]["xs:complexContent"]["xs:extension"]["xs:attribute"])
                ? element["xs:complexType"]["xs:complexContent"]["xs:extension"]["xs:attribute"]
                : [element["xs:complexType"]["xs:complexContent"]["xs:extension"]["xs:attribute"]];
            for (const attr of attrArray) {
                const attrName = attr.name || attr.$?.name;
                const documentation = attr["xs:annotation"]?.["xs:documentation"] || "";
                attributes[attrName] = documentation;
                console.log(`Added attribute: ${attrName} from xs:extension to element: ${name}`);
            }
        }

        // Hämta barns element från xs:group eller xs:choice
        if (element["xs:complexType"]?.["xs:choice"]?.["xs:element"]) {
            const childArray = Array.isArray(element["xs:complexType"]["xs:choice"]["xs:element"])
                ? element["xs:complexType"]["xs:choice"]["xs:element"]
                : [element["xs:complexType"]["xs:choice"]["xs:element"]];
            for (const child of childArray) {
                if (child.ref) {
                    childElements.push(child.ref);
                    console.log(`Added child element: ${child.ref} to element: ${name}`);
                }
            }
        }

        // Hantera baserade typer från xs:extension
        if (element["xs:complexType"]?.["xs:complexContent"]?.["xs:extension"]) {
            const base = element["xs:complexType"]["xs:complexContent"]["xs:extension"].base;
            if (base) {
                const baseElement = schema.elements[base] || schema.complexTypes[base];
                if (baseElement) {
                    console.log(`Before merge - element: ${name}, attributes: ${JSON.stringify(attributes)}, childElements: ${JSON.stringify(childElements)}`);
                    Object.assign(attributes, baseElement.attributes);
                    childElements.push(...baseElement.childElements);
                    console.log(`Merged attributes and child elements from base type: ${base} to element: ${name}`);
                    console.log(`After merge - element: ${name}, attributes: ${JSON.stringify(attributes)}, childElements: ${JSON.stringify(childElements)}`);
                } else {
                    console.warn(`Base type ${base} not found for element ${name}`);
                }
            }
        }

        schema.elements[name] = {
            attributes,
            childElements
        };

        console.log(`Processed element: ${name}, attributes: ${JSON.stringify(attributes)}, childElements: ${JSON.stringify(childElements)}`);
    };

    if (Array.isArray(elements)) {
        for (const el of elements) {
            processElement(el);
        }
    } else if (elements) {
        processElement(elements);
    }

    // Hantera xs:group (som "controls")
    const groups = result["xs:schema"]["xs:group"];
    if (groups) {
        const groupArray = Array.isArray(groups) ? groups : [groups];
        for (const group of groupArray) {
            if (group.name === "controls" && group["xs:choice"]?.["xs:element"]) {
                const childArray = Array.isArray(group["xs:choice"]["xs:element"])
                    ? group["xs:choice"]["xs:element"]
                    : [group["xs:choice"]["xs:element"]];
                for (const child of childArray) {
                    if (child.ref) {
                        schema.elements[child.ref] = schema.elements[child.ref] || { attributes: {}, childElements: [] };
                        console.log(`Added control element: ${child.ref}`);
                    }
                }
            }
        }
    }

    console.log('Parsed schema:', JSON.stringify(schema, null, 2));
    return schema;
}

export function generateGrammarFromXSD(schema: Schema): any {
    const grammar: {
        scopeName: string;
        patterns: any[];
        repository: { [key: string]: any };
    } = {
        scopeName: 'source.xaml',
        patterns: [],
        repository: {}
    };

    for (const elementName in schema.elements) {
        const element = schema.elements[elementName];
        grammar.repository[elementName] = {
            name: `entity.name.tag.xaml.${elementName}`,
            begin: `<${elementName}(\\s|>)`,
            end: `</${elementName}>`,
            patterns: element.childElements.map(child => ({ include: `#${child}` }))
        };
    }

    return grammar;
}