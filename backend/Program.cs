using System.Text.Json;
using Backend.Config;
using Backend.Data.Database;
DotNetEnv.Env.Load();

// Env.load();
var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
// Learn more about configuring Swagger/OpenAPI at https://aka.ms/aspnetcore/swashbuckle
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
var CONNECTION_STRING = Environment.GetEnvironmentVariable("CONNECTION_STRING")!;
var GOOGLE_OAUTH_CLIENT_ID = Environment.GetEnvironmentVariable("GOOGLE_OAUTH_CLIENT_ID")!;
var GOOGLE_OAUTH_CLIENT_SECRET = Environment.GetEnvironmentVariable("GOOGLE_OAUTH_CLIENT_SECRET")!;
if (string.IsNullOrWhiteSpace(CONNECTION_STRING))
    throw new InvalidOperationException("Falta la cadena de conexión 'Default' en la configuración.");
builder.Services
    .AddDatabase(CONNECTION_STRING)
    .AddServices()
    .AddAuth(GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, builder.Configuration);
builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
app.UseForwardedHeaders();
app.UseCors(AuthConfig.CorsPolicyName);
app.UseAuthentication();
app.UseAuthorization();

using (var scope = app.Services.CreateScope())
{
    var database = scope.ServiceProvider.GetRequiredService<AppDatabase>();
    database.Database.EnsureCreated();
}

app.MapControllers();

app.Run();
