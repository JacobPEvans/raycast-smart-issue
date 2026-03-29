{
  description = "AI-powered GitHub issue creation using local LLM inference";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixpkgs-unstable";
  };

  outputs =
    { nixpkgs, ... }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "x86_64-linux"
        "aarch64-linux"
      ];
      forAllSystems =
        f:
        nixpkgs.lib.genAttrs systems (
          system:
          f {
            pkgs = import nixpkgs {
              inherit system;
            };
          }
        );
    in
    {
      devShells = forAllSystems (
        { pkgs }:
        {
          default = pkgs.mkShell {
            buildInputs = with pkgs; [
              nodejs_22
              bun
            ];

            shellHook = ''
              if [ -z "''${DIRENV_IN_ENVRC:-}" ]; then
                echo "Smart Issue Creator — Development Environment"
                echo "  node: $(node --version)"
                echo "  bun:  $(bun --version)"
              fi
              if [ -f bun.lock ] && [ ! -d node_modules ]; then
                echo "Installing dependencies..."
                bun install
              fi
            '';
          };
        }
      );
    };
}
