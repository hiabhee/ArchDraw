/**
 * html-to-image often drops CSS stroke-dasharray on nested SVG paths.
 * Copy computed dash patterns onto SVG attributes right before raster export.
 */
export function prepareReactFlowForImageExport(root: HTMLElement): void {
  const paths = root.querySelectorAll<SVGPathElement>('.react-flow__edge-path');
  paths.forEach((path) => {
    const dash =
      path.style.strokeDasharray ||
      window.getComputedStyle(path).strokeDasharray;
    if (dash && dash !== 'none') {
      path.setAttribute('stroke-dasharray', dash);
    }
  });
}
