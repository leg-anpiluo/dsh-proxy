/**
 * CSS Modules type shim for the client bundle (the tsdown preset compiles
 * `*.module.css` into a hashed class map at build time).
 */
declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}
