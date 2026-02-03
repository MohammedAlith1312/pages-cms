# Component Registration & Usage Guide

This document explains how **Fields (Components)** are defined, registered, and used in the Pages CMS to build content pages. The system is modular and configuration-driven.

---

## 1. Architecture Overview

The CMS uses a **plugin-like architecture** for fields.

- **Location:** `fields/core/` (Standard fields) and `fields/custom/` (User-defined fields).
- **Structure:** Each field type is a **directory** containing an entry point (`index.tsx`) and React components.
- **Registry:** `fields/registry.ts` dynamically scans these directories to register them for use.

---

## 2. Anatomy of a Field Component

To create a field (e.g., `my-field`), you create a folder `fields/core/my-field/` with the following files:

### `index.tsx` (The Entry Point)
This file exports the configuration and behavior of the field.

```tsx
import { EditComponent } from "./edit-component";
import { z } from "zod";
import { Field } from "@/types/field";

// 1. Label: Display name in UI
export const label = "My Field";

// 2. Default Value: Initial state
export const defaultValue = (field: Field) => "";

// 3. Schema: Zod validation logic
export const schema = (field: Field, config?: any) => {
  let s = z.string();
  if (field.required) s = s.min(1, "Required");
  return s;
};

// 4. Data Transformations (Optional)
// Storage (e.g., Frontmatter) -> Application Form
export const read = (value: any, field: Field) => {
  return value || "";
}

// Application Form -> Storage
export const write = (value: any, field: Field) => {
  return value?.trim();
}

// 5. Components
export { EditComponent };
```

### `edit-component.tsx` (The Input Form)
The React component rendered when the user is editing content.

```tsx
import { Field } from "@/types/field";
import { Input } from "@/components/ui/input";

type Props = {
  field: Field;
  value: string;
  onChange: (value: string) => void;
  error?: { message: string };
};

export const EditComponent = ({ field, value, onChange, error }: Props) => {
  return (
    <div>
      <label>{field.label || field.name}</label>
      <Input 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
      />
      {error && <span className="text-red-500">{error.message}</span>}
    </div>
  );
};
```

---

## 3. The Registration Process

You simply need to **add the files** to the folder. **No manual import is needed.**

### `fields/registry.ts`
This file performs the "magic" using `require.context`:

```typescript
// Dynamically import all index.tsx files from fields/core and fields/custom
const importCoreFieldComponents = (require as any).context('@/fields/core', true, /index\.(ts|tsx)$/);

// Iterate and register
[importCoreFieldComponents, ...].forEach(importComponents => {
  importComponents.keys().forEach((key: string) => {
    // Extract name from path: "./string/index.tsx" -> "string"
    const fieldName = key.split('/')[1];
    const module = importComponents(key);

    // Register exports to global maps
    labels[fieldName] = module.label;
    schemas[fieldName] = module.schema;
    editComponents[fieldName] = module.EditComponent;
    // ... etc
  });
});
```

---

## 4. How Pages are Built with Components

When a user visits a generic content editing page (e.g., `/collection/posts/new`), the app dynamically assembles the form.

### The Flow:

1.  **Read Config:** The app reads `.pages.yml` to see which fields are defined for the collection.
    ```yaml
    fields:
      - name: title
        type: string  <-- Matches directory name
      - name: cover
        type: image
    ```

2.  **Retrieve Component:** The app looks up the component in the registry.
    ```typescript
    import { editComponents } from "@/fields/registry";
    
    // In the page renderer loop:
    const Component = editComponents[field.type];
    ```

3.  **Render:** The component is instantiated with the field config and current value.

### Code Example: `dynamic-form.tsx` (Conceptual)

```tsx
import { editComponents } from "@/fields/registry";

export function DynamicForm({ fields, data, onChange }) {
  return (
    <form>
      {fields.map((field) => {
        // 1. Lookup Component
        const Editor = editComponents[field.type];
        
        if (!Editor) return <div key={field.name}>Unknown field: {field.type}</div>;

        // 2. Render Component
        return (
          <Editor
            key={field.name}
            field={field}
            value={data[field.name]}
            onChange={(val) => onChange(field.name, val)}
          />
        );
      })}
    </form>
  );
}
```

---

## 5. Adding a New Component (Step-by-Step)

To add a generic "**Color Picker**" field:

1.  **Create Directory:** `fields/core/color/`
2.  **Create `edit-component.tsx`:**
    ```tsx
    export const EditComponent = ({ value, onChange }) => (
      <input type="color" value={value} onChange={e => onChange(e.target.value)} />
    );
    ```
3.  **Create `index.tsx`:**
    ```tsx
    import { z } from "zod";
    import { EditComponent } from "./edit-component";
    
    export const label = "Color";
    export const schema = () => z.string().regex(/^#[0-9a-f]{6}$/i);
    export { EditComponent };
    export const defaultValue = () => "#000000";
    ```
4.  **Use it in `.pages.yml`:**
    ```yaml
    fields:
      - name: background_color
        type: color
    ```

**That's it!** The registry will automatically find `fields/core/color/index.tsx` and make it available.
