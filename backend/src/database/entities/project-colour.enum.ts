/**
 * A fixed palette for project tags/swatches — deliberately not a free-form
 * hex value. The frontend's brand palette is closed (see
 * frontend/CLAUDE.md); these map 1:1 to a small set of `project-*` theme
 * tokens added specifically for this, so a project's colour is always one
 * of a known, themeable set rather than arbitrary user input.
 */
export enum ProjectColour {
  BLUE = 'blue',
  GREEN = 'green',
  AMBER = 'amber',
  RED = 'red',
  PURPLE = 'purple',
  TEAL = 'teal',
  PINK = 'pink',
  GRAY = 'gray',
}
