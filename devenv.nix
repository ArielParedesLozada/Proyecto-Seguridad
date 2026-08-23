{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: let
  dotnetCombined = pkgs.dotnetCorePackages.combinePackages [
    pkgs.dotnetCorePackages.sdk_8_0
    #pkgs.dotnetCorePackages.sdk_10_0
  ];
in {
  env.name = "overleaf";

  languages.dotnet = {
    enable = true;
    package = dotnetCombined;
    lsp.enable = true;
  };

  packages = with pkgs; [
    nodejs
    pnpm
    dotnet-ef
  ];

  # env.DOTNET_ROOT = "${dotnetCombined}";
  env.NIX_LD_LIBRARY_PATH = lib.makeLibraryPath (with pkgs; [
    icu
    openssl
    stdenv.cc.cc.lib
  ]);

  enterShell = ''
    export PATH="$PWD/frontend/node_modules/.bin:$PATH"
    echo "$(tput bold)hi! from $(tput setaf 199)$name$(tput sgr0)"
  '';

  enterTest = ''
    dotnet --version
    dotnet --list-runtimes
    node --version
    pnpm --version
  '';
}
