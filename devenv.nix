{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  env = {
    name = "overleaf";
    NIX_LD_LIBRARY_PATH = lib.makeLibraryPath (with pkgs; [
      icu
      openssl
      stdenv.cc.cc.lib
    ]);
    CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
  };

  languages.dotnet = {
    enable = true;
    package = pkgs.dotnetCorePackages.sdk_8_0;
    lsp.enable = true;
  };

  dotenv.disableHint = true;

  packages = with pkgs; [
    nodejs
    pnpm
    dotnet-ef
    chromium
  ];

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
