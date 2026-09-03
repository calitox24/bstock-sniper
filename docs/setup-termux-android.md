# Instalar graphify en Android (Termux + Debian)

Verificado el 2026-09-03 contra PyPI para ARM64.

## Por que Debian y no Termux a secas

graphify arrastra ~30 gramaticas `tree-sitter` compiladas. Todas publican
wheel `manylinux_2_17_aarch64`, que necesita **glibc**. Termux nativo usa
bionic (la libc de Android), asi que esos wheels no instalan ahi y habria que
compilar las 30 a mano. Dentro de Debian por proot-distro entran solas.

Espacio: contar ~165 MB de graphify + ~500 MB de Debian.

## 1. Debian dentro de Termux

```bash
pkg update && pkg upgrade -y
pkg install -y proot-distro
proot-distro install debian
proot-distro login debian
```

El ultimo comando te mete adentro de Debian. Todo lo que sigue va ahi.
Para volver a entrar mas adelante: `proot-distro login debian`.

## 2. Dependencias

```bash
apt update && apt install -y python3 python3-pip git curl
python3 --version    # tiene que ser 3.10 o mas; bookworm trae 3.11
```

## 3. graphify

```bash
pip install --break-system-packages uv
export PATH="$HOME/.local/bin:$PATH"
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc

uv tool install graphifyy
graphify --help      # si no lo encuentra: uv tool update-shell y reabri la shell
```

`--break-system-packages` hace falta porque Debian 12 marca su Python como
gestionado por apt (PEP 668). Solo afecta a `uv`; graphify queda aislado en
su propio entorno.

## 4. Clonar los repos

Son privados, asi que necesitas un token: GitHub -> Settings -> Developer
settings -> Personal access tokens -> Fine-grained, con permiso Contents
read/write sobre los repos.

```bash
git config --global credential.helper store
git clone https://github.com/calitox24/bstock-sniper
# usuario: calitox24   contrasena: el token (no la clave de la cuenta)
```

Una vez guardado, los demas clones no vuelven a pedirlo:

```bash
git clone https://github.com/calitox24/MiniKommoRD
git clone https://github.com/calitox24/MiniKommoRD-backend
```

## 5. Activar graphify en cada repo

```bash
for r in bstock-sniper MiniKommoRD MiniKommoRD-backend; do
  (cd ~/$r && bash scripts/setup-graphify.sh)
done
```

Eso apunta `core.hooksPath` a `.githooks/` (los hooks ya estan versionados)
y registra el driver de merge para `graphify-out/graph.json`.

## 6. Comprobar

```bash
cd ~/bstock-sniper
graphify query "como se capturan los lotes"
graphify god-nodes --top 5
```

Y que el hook dispare de verdad:

```bash
git commit --allow-empty -m "prueba hook"
# tiene que imprimir: [graphify hook] launching background rebuild
git log -1 --stat
```

## Si algo falla

| Sintoma | Causa |
|---|---|
| `graphify: command not found` | Falta `~/.local/bin` en el PATH. Ver paso 3. |
| `externally-managed-environment` | Falta `--break-system-packages` en el `pip install uv`. |
| El hook no dispara | `git config --get core.hooksPath` tiene que decir `.githooks`. Si no, corre `scripts/setup-graphify.sh`. |
| Compila tree-sitter en vez de bajar wheels | Estas en Termux nativo, no dentro de Debian. Corre `proot-distro login debian`. |

Desactivar el hook un rato: `GRAPHIFY_SKIP_HOOK=1 git commit ...`
