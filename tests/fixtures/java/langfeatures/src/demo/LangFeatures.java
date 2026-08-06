package demo;

import java.io.IOException;
import java.util.List;
import java.util.function.Supplier;

public class LangFeatures {
    public String field = "x";

    public void instantiates() {
        String s = new String("hi");
        System.out.println(s);
    }

    public void fieldAndClassLiteral() {
        String v = this.field;
        Class<?> c = String.class;
        System.out.println(v);
        System.out.println(c);
    }

    public void typeUse(List<@NonNull String> xs) {
        System.out.println(xs);
    }

    public <T> void genericThrows(T value) throws IOException {
        if (value == null) {
            throw new IOException("null");
        }
    }

    public Supplier<String> lambda() {
        return () -> "ok";
    }
}
