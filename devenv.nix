{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  env = {
    name = "overleaf";
  };
  packages = with pkgs; [
    dotnet-sdk
    nodejs
    pnpm
  ];
  enterShell = ''
    export PATH="$PWD/frontend/node_modules/.bin:$PATH"
    echo "$(tput bold)hi! from $(tput setaf 199)$name$(tput sgr0)"
  '';
  enterTest = ''
    dotnet --version
    node --version
    pnpm --version
  '';
}
