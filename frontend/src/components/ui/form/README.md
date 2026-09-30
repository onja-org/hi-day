# Form fields

Reusable labelled field components. Every one of them renders a visible
`<label>` that wraps its control, which associates the label with the field
without needing a separately-managed `id`/`htmlFor` pair — screen readers
announce the label whenever the field receives focus.

Use these instead of a raw `<input>`/`<select>`/`<textarea>` in any form.
Each one accepts the same native attributes the raw element would (`name`,
`required`, `type`, `defaultValue`, `onChange`, etc.) plus `label`, and
renders with this app's standard field styling so every form looks and
behaves the same.

## Components

- **`TextField`** — single-line `<input>`. Set `type` for anything other
  than `text` (`email`, `password` without a visibility toggle, `number`,
  `date`, `datetime-local`, `search`, `url`, …).
- **`TextareaField`** — multi-line `<textarea>`.
- **`SelectField`** — `<select>`. Pass `<option>`s as children exactly as
  you would for a raw `<select>`.
- **`CheckboxField`** — a single checkbox with its label after the box.
- **`PasswordField`** — a password field with a show/hide toggle (wraps
  `PasswordInput`).
- **`Label`** — the one caption style every field above renders its `label`
  prop through internally (`text-sm font-medium text-slate-900`), so don't
  pass a `<Label>` yourself into `TextField`/`SelectField`/`TextareaField`/
  `PasswordField`'s `label` prop — a plain string/node is enough, they wrap
  it for you. Use `<Label>` directly only for a caption that isn't going
  through one of those (a filter toolbar's caption above `SearchableSelect`,
  `DayNavigator`, `DateRangePicker`, or a per-row caption like
  `MemberSelectRow`'s "Role"). Pass `htmlFor` when the caption needs to
  associate with a control that doesn't already wrap its own `<label>`
  (`DateRangePicker`) — it renders a real `<label>` in that case, a plain
  `<span>` otherwise.

`TextField`/`SelectField` also accept a `compact` boolean that shrinks the
*field's* padding/text size for tight contexts like filter toolbars — the
label stays the same size regardless, so every label in the app reads at
one consistent size no matter how compact its field is.

Every component also accepts an optional `hint` node, rendered as small
helper text below the field (e.g. "Shown on the dashboard...", "JPG or PNG,
up to 1.5MB.").

## Example

```tsx
import { TextField, SelectField, TextareaField, CheckboxField } from "@/components/form";

<TextField label="Name" name="name" type="text" required maxLength={255} />

<TextareaField label="Description (optional)" name="description" rows={3} />

<SelectField label="Assignee (optional)" name="assigneeProjectMembershipId">
  <option value="">Unassigned</option>
  {members.map((member) => (
    <option key={member.id} value={member.id}>{member.name}</option>
  ))}
</SelectField>

<CheckboxField label="Enable screenshots" name="screenshotsEnabled" defaultChecked />
```

## When NOT to use these

A few other reusable, already-accessible field components already exist in
`frontend/src/components/` for specific needs — don't replace them with the
above, and don't force them to relayer on top of these:

- **`Toggle`** — a switch-styled checkbox with a title + description, used
  on the Settings page.
- **`NumberFieldWithUnit`** — a number input with a fixed unit suffix (e.g.
  "5 | min").
- **`MultiSelectDropdown`** — a button-triggered checklist panel used where
  a native multi-select would be the right control but can't be styled — no
  raw `<input>`/`<select>` of its own to share.
- **`SearchableSelect`** — an accessible type-to-search combobox over a
  small option list, used for the Project/Member activity filters.

All four already render (or accept) a properly associated label — their own
outer `<label>`/switch/combobox markup doesn't fit inside `TextField`'s or
`CheckboxField`'s wrapping `<label>` without nesting labels (invalid HTML,
and it double-toggles a checkbox). Reach for `TextField`/`SelectField`/etc.
above for anything else.

None of these render a shared bare-input atom — `TextField`, `CheckboxField`,
`Toggle`, `NumberFieldWithUnit`, `SearchableSelect`, and `SearchInput` each
render their own plain `<input>` directly. Their styling
needs (border/rounding, padding, pill vs. rectangular, switch vs. checkbox)
differ too much for one shared default to fit all of them. `PasswordField`
wraps `PasswordInput`, which the show/hide toggle makes different enough
that it isn't a candidate for sharing either.

## When a visible label genuinely doesn't fit

A handful of per-row controls inside data tables (e.g. a role `<select>` in
`ProjectMembersSection`'s members table) rely on the
table's own column header for visual context, so repeating a visible label
on every row would just be noise. Pass `SelectField`'s `hideLabel` there —
it keeps the label (and its accessible association) but visually hides it,
same as a hand-written screen-reader-only `<label htmlFor>` would. That's a
deliberate, narrow exception — for every field in an actual form (create/edit
modals, settings pages, filter toolbars), leave `hideLabel` off so the label
is visible.
