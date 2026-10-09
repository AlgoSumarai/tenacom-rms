using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Configuration;

namespace Tenacom.Api.Tests;

public sealed class ProductionConfigurationTests
{
    [Theory]
    [InlineData("false", "https://network.example.test")]
    [InlineData("true", "http://network.example.test")]
    [InlineData("true", "https://network.example.test/path")]
    public void ProductionRejectsInsecureCookieOrOriginConfiguration(string secureCookies, string origin)
    {
        using var factory = new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Production");
            builder.ConfigureAppConfiguration((_, config) => config.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Security:SecureCookies"] = secureCookies,
                ["Security:Origin"] = origin
            }));
        });
        Assert.Throws<InvalidOperationException>(() => factory.CreateClient());
    }
}
