import * as fs from 'fs';
import * as xml2js from 'xml2js';

interface SchemaElement {
  attributes: { [key: string]: string };
  childElements: string[];
}

interface Schema {
  elements: { [key: string]: SchemaElement };
}

export async function parseXSD(filePath: string): Promise<Schema> {
  const xsdContent = fs.readFileSync(filePath, 'utf-8');
  const parser = new xml2js.Parser({ explicitArray: false, mergeAttrs: true });
  const result = await parser.parseStringPromise(xsdContent);

  const schema: Schema = { elements: {} };

  const addElement = (element: any, baseType: string = '') => {
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
        }
      }
    }

    // Hantera baserade typer från xs:extension
    if (element["xs:complexType"]?.["xs:complexContent"]?.["xs:extension"]) {
      const base = element["xs:complexType"]["xs:complexContent"]["xs:extension"].base;
      if (base && schema.elements[base]) {
        Object.assign(attributes, schema.elements[base].attributes);
        childElements.push(...schema.elements[base].childElements);
      }
    }

    schema.elements[name] = {
      attributes,
      childElements
    };
  };

  // Hämta alla xs:element i schemat
  const elements = result["xs:schema"]["xs:element"];
  if (Array.isArray(elements)) {
    for (const el of elements) {
      addElement(el);
    }
  } else if (elements) {
    addElement(elements);
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
          }
        }
      }
    }
  }

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