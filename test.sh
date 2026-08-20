cd dashboard && npm run build:universe
cd ..
cargo build --release
cd example/metasfresh-4.9.8b/
rm -rf .rgbuilder
../../target/release/rg-build discover . --with-universe
../../target/release/rg-build serve --open
