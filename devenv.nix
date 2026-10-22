{
  pkgs,
  lib,
  config,
  inputs,
  ...
}: {
  env.name = "overleaf";

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
    # Font
    # fontconfig
    # freetype
  ];

  env.NIX_LD_LIBRARY_PATH = lib.makeLibraryPath (with pkgs; [
    # .NET Linter
    icu
    openssl
    stdenv.cc.cc.lib
    # Chromium
    # glib
    # nss
    # nspr
    # atk
    # at-spi2-atk
    # cups
    # dbus
    # expat
    # libdrm
    # libxkbcommon
    # libgbm
    # mesa
    # xorg.libX11
    # xorg.libXcomposite
    # xorg.libXdamage
    # xorg.libXext
    # xorg.libXfixes
    # xorg.libXrandr
    # xorg.libxcb
    # pango
    # cairo
    # alsa-lib
    # udev
  ]);
  env.CHROMIUM_PATH = "${pkgs.chromium}/bin/chromium";
  # env.FONTCONFIG_FILE = pkgs.makeFontsConf {
  #   fontDirectories = with pkgs; [
  #     dejavu_fonts
  #     liberation_ttf
  #     noto-fonts
  #   ];
  # };

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
