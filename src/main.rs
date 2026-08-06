//! rgBuilder CLI entry point.

use clap::Parser;
use rgbuilder::cli::Cli;

fn main() -> anyhow::Result<()> {
    rgbuilder::init();
    Cli::parse().run()
}
